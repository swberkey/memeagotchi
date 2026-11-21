/* Ember Vale - ESP-IDF platform layer: ST7789 over SPI DMA, GPIO buttons,
 * stdio save files. */
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <errno.h>
#include <stdlib.h>
#include <unistd.h>
#include "esp_check.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_heap_caps.h"
#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "esp_lcd_panel_st7789.h"
#include "sdkconfig.h"
#include "ember_vale_esp.h"
/* bool Kconfig options are left undefined when off */
#ifdef CONFIG_EV_LCD_SWAP_XY
#define EV_SWAP_XY true
#else
#define EV_SWAP_XY false
#endif
#ifdef CONFIG_EV_LCD_MIRROR_X
#define EV_MIRROR_X true
#else
#define EV_MIRROR_X false
#endif
#ifdef CONFIG_EV_LCD_MIRROR_Y
#define EV_MIRROR_Y true
#else
#define EV_MIRROR_Y false
#endif

static const char *TAG = "ember_vale";

#define W EV_SCREEN_W
#define H EV_SCREEN_H
#define BAND CONFIG_EV_BAND_LINES

static char s_dir[96];
static volatile bool s_exit_req;
static SemaphoreHandle_t s_band_free;

/* --------------------------------------------------------------- files */
static void path_of(char *out, size_t n, const char *dir, const char *name)
{
    snprintf(out, n, "%s/%s", dir, name);
}

static int file_write(void *user, const char *name, const void *data, uint32_t len)
{
    char dst[128], tmp[sizeof dst + 8];
    path_of(dst, sizeof dst, s_dir, name);
    snprintf(tmp, sizeof tmp, "%s.tmp", dst);
    FILE *f = fopen(tmp, "wb");
    if (!f) {
        ESP_LOGW(TAG, "can't write %s (%d)", tmp, errno);
        return -1;
    }
    size_t w = fwrite(data, 1, len, f);
    fflush(f);
    fsync(fileno(f));
    fclose(f);
    if (w != len) return -1;
    /* replace atomically where the filesystem allows it (FATFS can't
     * rename over an existing file, so remove first) */
    remove(dst);
    if (rename(tmp, dst) != 0) {
        ESP_LOGW(TAG, "rename %s failed (%d)", tmp, errno);
        return -1;
    }
    return 0;
}

static int32_t file_read(void *user, const char *name, void *buf, uint32_t maxlen)
{
    char p[128];
    path_of(p, sizeof p, s_dir, name);
    FILE *f = fopen(p, "rb");
    if (!f) {
        /* a crash between remove() and rename() leaves only the .tmp */
        char tmp[140];
        snprintf(tmp, sizeof tmp, "%s.tmp", p);
        f = fopen(tmp, "rb");
        if (!f) return -1;
    }
    int32_t n = (int32_t)fread(buf, 1, maxlen, f);
    fclose(f);
    return n;
}

/* ------------------------------------------------------------- buttons */
static const int s_btn_pins[7] = {
    CONFIG_EV_PIN_UP, CONFIG_EV_PIN_DOWN, CONFIG_EV_PIN_LEFT, CONFIG_EV_PIN_RIGHT,
    CONFIG_EV_PIN_X, CONFIG_EV_PIN_O, CONFIG_EV_PIN_START,
};

static void buttons_init(void)
{
    uint64_t mask = 0;
    for (int i = 0; i < 7; i++)
        if (s_btn_pins[i] >= 0) mask |= 1ULL << s_btn_pins[i];
    if (!mask) return;
    gpio_config_t io = {
        .pin_bit_mask = mask,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io);
}

static uint8_t buttons_read_gpio(void *ctx)
{
    uint8_t b = 0;
    for (int i = 0; i < 7; i++)
        if (s_btn_pins[i] >= 0 && gpio_get_level(s_btn_pins[i]) == 0) b |= (uint8_t)(1 << i);
    /* opposite d-pad directions cancel out */
    if ((b & (EV_BTN_LEFT | EV_BTN_RIGHT)) == (EV_BTN_LEFT | EV_BTN_RIGHT)) b &= (uint8_t)~(EV_BTN_LEFT | EV_BTN_RIGHT);
    if ((b & (EV_BTN_UP | EV_BTN_DOWN)) == (EV_BTN_UP | EV_BTN_DOWN)) b &= (uint8_t)~(EV_BTN_UP | EV_BTN_DOWN);
    return b;
}

/* ----------------------------------------------------------------- LCD */
static bool on_trans_done(esp_lcd_panel_io_handle_t io, esp_lcd_panel_io_event_data_t *ev, void *ctx)
{
    BaseType_t woken = pdFALSE;
    xSemaphoreGiveFromISR(s_band_free, &woken);
    return woken == pdTRUE;
}

typedef struct {
    esp_lcd_panel_handle_t panel;
    esp_lcd_panel_io_handle_t io;
    bool own;
} lcd_t;

static esp_err_t lcd_init(lcd_t *lcd)
{
    spi_bus_config_t bus = {
        .sclk_io_num = CONFIG_EV_PIN_SCLK,
        .mosi_io_num = CONFIG_EV_PIN_MOSI,
        .miso_io_num = -1,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = W * BAND * sizeof(uint16_t),
    };
    spi_host_device_t host = CONFIG_EV_LCD_SPI_HOST == 3 ? SPI3_HOST : SPI2_HOST;
    ESP_RETURN_ON_ERROR(spi_bus_initialize(host, &bus, SPI_DMA_CH_AUTO), TAG, "spi bus");

    esp_lcd_panel_io_spi_config_t io_cfg = {
        .dc_gpio_num = CONFIG_EV_PIN_DC,
        .cs_gpio_num = CONFIG_EV_PIN_CS,
        .pclk_hz = CONFIG_EV_LCD_PCLK_MHZ * 1000 * 1000,
        .lcd_cmd_bits = 8,
        .lcd_param_bits = 8,
        .spi_mode = 0,
        .trans_queue_depth = 4,
        .on_color_trans_done = on_trans_done,
    };
    ESP_RETURN_ON_ERROR(esp_lcd_new_panel_io_spi((esp_lcd_spi_bus_handle_t)host, &io_cfg, &lcd->io), TAG, "panel io");

    esp_lcd_panel_dev_config_t dev = {
        .reset_gpio_num = CONFIG_EV_PIN_RST,
#ifdef CONFIG_EV_LCD_BGR
        .rgb_ele_order = LCD_RGB_ELEMENT_ORDER_BGR,
#else
        .rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB,
#endif
        .bits_per_pixel = 16,
    };
    ESP_RETURN_ON_ERROR(esp_lcd_new_panel_st7789(lcd->io, &dev, &lcd->panel), TAG, "st7789");
    esp_lcd_panel_reset(lcd->panel);
    esp_lcd_panel_init(lcd->panel);
#ifdef CONFIG_EV_LCD_INVERT
    esp_lcd_panel_invert_color(lcd->panel, true);
#endif
    esp_lcd_panel_swap_xy(lcd->panel, EV_SWAP_XY);
    esp_lcd_panel_mirror(lcd->panel, EV_MIRROR_X, EV_MIRROR_Y);
    esp_lcd_panel_set_gap(lcd->panel, CONFIG_EV_LCD_X_GAP, CONFIG_EV_LCD_Y_GAP);
    esp_lcd_panel_disp_on_off(lcd->panel, true);
    if (CONFIG_EV_PIN_BL >= 0) {
        gpio_config_t bl = {.pin_bit_mask = 1ULL << CONFIG_EV_PIN_BL, .mode = GPIO_MODE_OUTPUT};
        gpio_config(&bl);
        gpio_set_level(CONFIG_EV_PIN_BL, CONFIG_EV_BL_ON_LEVEL);
    }
    lcd->own = true;
    return ESP_OK;
}

static void lcd_deinit(lcd_t *lcd)
{
    if (!lcd->own) return;
    esp_lcd_panel_del(lcd->panel);
    esp_lcd_panel_io_del(lcd->io);
    spi_bus_free(CONFIG_EV_LCD_SPI_HOST == 3 ? SPI3_HOST : SPI2_HOST);
}

/* ---------------------------------------------------------------- wallet */
static int32_t parse_coins(const char *s)
{
    const char *p = strstr(s, "\"coins\"");
    if (!p) return -1;
    p += 7;
    while (*p == ' ' || *p == ':') p++;
    return (int32_t)strtol(p, NULL, 10);
}

int32_t ember_vale_wallet_get(const char *save_dir)
{
    char p[128], buf[160];
    snprintf(p, sizeof p, "%s/wallet.json", save_dir ? save_dir : CONFIG_EV_SAVE_DIR);
    FILE *f = fopen(p, "rb");
    if (!f) return 0;
    size_t n = fread(buf, 1, sizeof buf - 1, f);
    fclose(f);
    buf[n] = 0;
    int32_t c = parse_coins(buf);
    return c < 0 ? 0 : c;
}

esp_err_t ember_vale_wallet_set(const char *save_dir, int32_t coins)
{
    char p[128], buf[160], out[160];
    const char *dir = save_dir ? save_dir : CONFIG_EV_SAVE_DIR;
    long life = 0;
    snprintf(p, sizeof p, "%s/wallet.json", dir);
    FILE *f = fopen(p, "rb");
    if (f) {
        size_t n = fread(buf, 1, sizeof buf - 1, f);
        fclose(f);
        buf[n] = 0;
        const char *l = strstr(buf, "\"lifetime_coins\"");
        if (l) { l += 16; while (*l == ' ' || *l == ':') l++; life = strtol(l, NULL, 10); }
    }
    if (coins < 0) coins = 0;
    int n = snprintf(out, sizeof out, "{\"coins\":%ld,\"lifetime_coins\":%ld,\"version\":1}\n", (long)coins, life);
    snprintf(s_dir, sizeof s_dir, "%s", dir);
    return file_write(NULL, "wallet.json", out, (uint32_t)n) == 0 ? ESP_OK : ESP_FAIL;
}

void ember_vale_request_exit(void) { s_exit_req = true; }

/* ------------------------------------------------------------------ run */
esp_err_t ember_vale_run(const ember_vale_config_t *cfg, ember_vale_result_t *result)
{
    ember_vale_config_t c = EMBER_VALE_CONFIG_DEFAULT();
    if (cfg) c = *cfg;
    snprintf(s_dir, sizeof s_dir, "%s", c.save_dir ? c.save_dir : CONFIG_EV_SAVE_DIR);
    mkdir(s_dir, 0775);
    s_exit_req = false;

    lcd_t lcd = {.panel = c.panel, .io = c.panel_io, .own = false};
    s_band_free = xSemaphoreCreateCounting(2, 2);
    if (!s_band_free) return ESP_ERR_NO_MEM;
    if (!lcd.panel) {
        esp_err_t e = lcd_init(&lcd);
        if (e != ESP_OK) { vSemaphoreDelete(s_band_free); return e; }
    } else if (lcd.io) {
        /* host-owned panel: hook the transfer-done callback for buffer reuse */
        esp_lcd_panel_io_callbacks_t cbs = {.on_color_trans_done = on_trans_done};
        esp_lcd_panel_io_register_event_callbacks(lcd.io, &cbs, NULL);
    }
    if (!c.read_buttons) { buttons_init(); c.read_buttons = buttons_read_gpio; }

    /* two band buffers in internal DMA-capable RAM: render one while the
     * other is on the wire */
    uint16_t *band[2];
    for (int i = 0; i < 2; i++) {
        band[i] = heap_caps_malloc(W * BAND * sizeof(uint16_t), MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL);
        if (!band[i]) {
            ESP_LOGE(TAG, "no DMA memory for band buffers");
            if (i) heap_caps_free(band[0]);
            lcd_deinit(&lcd);
            vSemaphoreDelete(s_band_free);
            return ESP_ERR_NO_MEM;
        }
    }

    ev_platform_t plat = {.file_write = file_write, .file_read = file_read, .user = NULL, .swap_bytes = 1};
    ev_init(&plat);
    int32_t coins0 = ev_coins();
    ESP_LOGI(TAG, "started, save folder %s, wallet %ld coins", s_dir, (long)coins0);

    const int64_t tick_us = 16667;
    int64_t next = esp_timer_get_time();
    uint32_t frames = 0;
    int nb = 0;
    for (;;) {
        uint8_t b = c.read_buttons(c.buttons_ctx);
        if (ev_update(b) == EV_EXIT) break;
        if (s_exit_req) { ev_save(); break; }
        frames++;
        next += tick_us;
        int64_t now = esp_timer_get_time();
        if (now > next + 4 * tick_us) next = now;   /* don't spiral after a stall */
        if (now <= next) {
            /* we have time: draw this tick */
            for (int y = 0; y < H; y += BAND) {
                int rows = H - y < BAND ? H - y : BAND;
                xSemaphoreTake(s_band_free, portMAX_DELAY);
                ev_render(band[nb], y, rows);
                esp_lcd_panel_draw_bitmap(lcd.panel, 0, y, W, y + rows, band[nb]);
                nb ^= 1;
            }
            now = esp_timer_get_time();
            if (next > now) vTaskDelay(pdMS_TO_TICKS((next - now) / 1000) ? pdMS_TO_TICKS((next - now) / 1000) : 1);
        }
        /* else: skip drawing this tick to catch up (logic stays 60 Hz) */
    }
    /* wait for both bands to finish before freeing */
    xSemaphoreTake(s_band_free, portMAX_DELAY);
    xSemaphoreTake(s_band_free, portMAX_DELAY);
    heap_caps_free(band[0]);
    heap_caps_free(band[1]);
    lcd_deinit(&lcd);
    vSemaphoreDelete(s_band_free);
    if (result) {
        result->coins = ev_coins();
        result->coins_change = ev_coins() - coins0;
        result->frames = frames;
    }
    ESP_LOGI(TAG, "exited, wallet %ld coins", (long)ev_coins());
    return ESP_OK;
}
