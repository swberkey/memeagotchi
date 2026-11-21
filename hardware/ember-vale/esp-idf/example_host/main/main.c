/*
 * Example host app for the Ember Vale addon.
 *
 * Shows the three things a real host does:
 *   1. mount a flash filesystem and give the game a folder in it,
 *   2. launch the game and wait for it to return,
 *   3. read wallet.json and turn coins into host money.
 */
#include <stdio.h>
#include <sys/stat.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_vfs_fat.h"
#include "driver/gpio.h"
#include "sdkconfig.h"
#include "ember_vale_esp.h"

static const char *TAG = "host";
#define STORAGE "/storage"
#define GAME_DIR STORAGE "/adventure"
#define BANK_FILE STORAGE "/host_bank.txt"

static long bank_load(void)
{
    long v = 0;
    FILE *f = fopen(BANK_FILE, "r");
    if (f) { if (fscanf(f, "%ld", &v) != 1) v = 0; fclose(f); }
    return v;
}

static void bank_save(long v)
{
    FILE *f = fopen(BANK_FILE, "w");
    if (f) { fprintf(f, "%ld\n", v); fclose(f); }
}

void app_main(void)
{
    /* 1. flash folder for saves (FAT on the "storage" partition) */
    static wl_handle_t wl;
    esp_vfs_fat_mount_config_t mc = {
        .format_if_mount_failed = true,
        .max_files = 4,
        .allocation_unit_size = CONFIG_WL_SECTOR_SIZE,
    };
    ESP_ERROR_CHECK(esp_vfs_fat_spiflash_mount_rw_wl(STORAGE, "storage", &mc, &wl));
    mkdir(GAME_DIR, 0775);

    for (;;) {
        long bank = bank_load();
        ESP_LOGI(TAG, "host bank: %ld credits, game wallet: %ld coins", bank, (long)ember_vale_wallet_get(GAME_DIR));

        /* 2. launch the addon; returns on Save & Exit */
        ember_vale_config_t cfg = EMBER_VALE_CONFIG_DEFAULT();
        cfg.save_dir = GAME_DIR;
        ember_vale_result_t res;
        ESP_ERROR_CHECK(ember_vale_run(&cfg, &res));

        /* 3. exchange: 1 coin = 1 credit, then empty the wallet */
        int32_t coins = ember_vale_wallet_get(GAME_DIR);
        if (coins > 0) {
            bank += coins;
            bank_save(bank);
            ember_vale_wallet_set(GAME_DIR, 0);
            ESP_LOGI(TAG, "cashed out %ld coins, bank now %ld", (long)coins, bank);
        }

        /* a real host would show its own menu here; we wait for Start */
        ESP_LOGI(TAG, "press Start to play again");
        if (CONFIG_EV_PIN_START >= 0) {
            while (gpio_get_level(CONFIG_EV_PIN_START) == 0) vTaskDelay(pdMS_TO_TICKS(20));
            while (gpio_get_level(CONFIG_EV_PIN_START) != 0) vTaskDelay(pdMS_TO_TICKS(20));
        } else {
            vTaskDelay(pdMS_TO_TICKS(3000));
        }
    }
}
