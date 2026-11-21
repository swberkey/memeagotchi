/*
 * Ember Vale - ESP-IDF launcher API.
 *
 * The host app calls ember_vale_run() from one of its tasks. The call takes
 * over the LCD and buttons, runs the game at 60 ticks per second and returns
 * when the player picks "Save & Exit" (or ember_vale_request_exit() is
 * called). Progress is written to cfg->save_dir:
 *
 *   save.dat     game progress (binary, versioned, checksummed)
 *   wallet.json  {"coins":N,"lifetime_coins":M,"version":1}
 *   status.json  {"game":"ember_vale","hearts":..,"crystals":..,...}
 *
 * Coins: the host owns the exchange rate. To cash coins out, read
 * wallet.json after the game returns, credit the player in the host app and
 * write the remaining coins back (ember_vale_wallet_set()). The game reads
 * wallet.json at start-up, so the host's value always wins.
 */
#pragma once
#include <stdint.h>
#include "esp_err.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "ember_vale.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    /* Folder for the save files. Must already be mounted and writable.
     * NULL = CONFIG_EV_SAVE_DIR. Created if missing. */
    const char *save_dir;

    /* Optional: a panel the host already set up (320x240 landscape,
     * RGB565). Pass both or neither. When NULL the game sets up the
     * ST7789 itself from the Kconfig pins and frees it on return. */
    esp_lcd_panel_handle_t panel;
    esp_lcd_panel_io_handle_t panel_io;

    /* Optional: host-provided button reader returning EV_BTN_* bits.
     * When NULL the game reads the Kconfig GPIOs (active low). */
    uint8_t (*read_buttons)(void *ctx);
    void *buttons_ctx;
} ember_vale_config_t;

#define EMBER_VALE_CONFIG_DEFAULT() { NULL, NULL, NULL, NULL, NULL }

typedef struct {
    int32_t coins;          /* wallet after the session */
    int32_t coins_change;   /* wallet difference over the session (spent coins count negative) */
    uint32_t frames;        /* ticks played this session */
} ember_vale_result_t;

/* Blocking. Needs about 8 KB of task stack. */
esp_err_t ember_vale_run(const ember_vale_config_t *cfg, ember_vale_result_t *result);

/* Ask a running game to save and return (safe from another task). */
void ember_vale_request_exit(void);

/* Helpers for the host: read / write the coin count in wallet.json. */
int32_t ember_vale_wallet_get(const char *save_dir);
esp_err_t ember_vale_wallet_set(const char *save_dir, int32_t coins);

#ifdef __cplusplus
}
#endif
