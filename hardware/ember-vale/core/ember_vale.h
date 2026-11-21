/*
 * Ember Vale - portable game core.
 *
 * The core knows nothing about the hardware. A platform layer (ESP-IDF,
 * browser, SDL, test harness) feeds it one button bitmask per 60 Hz tick and
 * asks it to draw rows of a 320x240 RGB565 frame.
 */
#pragma once
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define EV_SCREEN_W 320
#define EV_SCREEN_H 240

enum {
    EV_BTN_UP = 1 << 0,
    EV_BTN_DOWN = 1 << 1,
    EV_BTN_LEFT = 1 << 2,
    EV_BTN_RIGHT = 1 << 3,
    EV_BTN_X = 1 << 4,      /* sword / talk / confirm */
    EV_BTN_O = 1 << 5,      /* use selected item / back */
    EV_BTN_START = 1 << 6,  /* inventory + pause */
};

typedef struct {
    /* Write a whole file into the save folder. name is a bare file name
     * such as "save.dat". Return 0 on success. */
    int (*file_write)(void *user, const char *name, const void *data, uint32_t len);
    /* Read a whole file. Return bytes read, or -1 if it does not exist. */
    int32_t (*file_read)(void *user, const char *name, void *buf, uint32_t maxlen);
    void *user;
    /* 1 = output big-endian RGB565 (what SPI LCDs such as the ST7789 want
     * when fed straight from a little-endian MCU). 0 = native order. */
    int swap_bytes;
} ev_platform_t;

typedef enum { EV_RUNNING = 0, EV_EXIT = 1 } ev_status_t;

/* Start the game (shows the title screen). Loads saves through the platform. */
void ev_init(const ev_platform_t *platform);

/* Advance one 1/60 s tick. Returns EV_EXIT when the player chose
 * "Save & Exit"; the game has already saved by then. */
ev_status_t ev_update(uint8_t buttons);

/* Draw screen rows [y0, y0 + rows) into dst (320 * rows pixels, RGB565).
 * Call it for consecutive bands to build a frame; any band height works. */
void ev_render(uint16_t *dst, int y0, int rows);

/* Write save.dat, wallet.json and status.json now. */
void ev_save(void);

/* Coins currently in the player's wallet (what wallet.json holds). */
int32_t ev_coins(void);

#ifdef __cplusplus
}
#endif
