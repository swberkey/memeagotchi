/* Ember Vale - internal game state shared by the core's .c files. */
#pragma once
#include <stdint.h>
#include <string.h>
#include "ember_vale.h"
#include "gen_assets.h"
#include "gen_world.h"

#define RW 20
#define RH 14
#define PLAY_Y 16           /* HUD height */
#define FP 16               /* fixed point: 1/16 pixel */
#define MAX_ENTS 48
#define SAVE_VERSION 1

enum { D_DOWN = 0, D_UP = 1, D_LEFT = 2, D_RIGHT = 3 };
extern const int8_t DIR_DX[4], DIR_DY[4];

enum {
    MODE_TITLE, MODE_PLAY, MODE_SCROLL, MODE_FADEOUT, MODE_FADEIN, MODE_DIALOG,
    MODE_MENU, MODE_GAMEOVER, MODE_FALL, MODE_ENDING
};

enum { H_NORMAL, H_ATTACK, H_HURT, H_HOLD };

/* Entity types. 1..12 enemies (SP_*), 20..24 world spawns, 30+ runtime. */
enum {
    E_NONE = 0,
    E_NPC = SP_NPC, E_FAIRY = SP_FAIRY, E_HEARTC = SP_HEARTC, E_COIN = SP_COIN, E_SHOPITEM = SP_SHOPITEM,
    E_PICK_HEART = 30, E_PICK_GOLD, E_PICK_SILVER, E_PICK_RED, E_PICK_BOMBS, E_PICK_ARROWS, E_PICK_CRYSTAL,
    E_BOMB = 40, E_ARROW, E_BOOMERANG, E_EXPLOSION, E_POOF, E_SPORE, E_FIREBALL, E_SPARKLE,
};
#define IS_ENEMY(t) ((t) >= SP_BLOB && (t) <= SP_WISP)
#define IS_BOSS(t) ((t) == SP_THORNBACK || (t) == SP_WISP)
#define IS_PICKUP(t) (((t) >= E_PICK_HEART && (t) <= E_PICK_CRYSTAL) || (t) == E_HEARTC)

typedef struct {
    uint8_t type, dir, state, arg;
    int32_t x, y;           /* top-left of sprite, 1/16 px */
    int32_t vx, vy;         /* velocity, 1/16 px per tick */
    int16_t hp;
    uint16_t timer, timer2;
    uint8_t iframes, stun, kbt, anim;
    int16_t kbx, kby;
    uint16_t flag;
    int16_t hx, hy;         /* home position (pixels) */
    uint8_t w, h;           /* sprite size in px */
} ent_t;

typedef struct {
    /* persistent (saved) */
    uint8_t max_hearts;     /* in hearts */
    uint8_t hp;             /* in half hearts */
    uint8_t bombs, max_bombs, arrows, max_arrows;
    uint8_t has_bow, has_boomerang, has_bombs, sel;
    uint8_t keys[3];
    uint8_t flags[32];
    uint8_t visited[8];
    int32_t coins, lifetime_coins;
    uint32_t play_frames;
    uint16_t deaths;
    uint8_t complete;
    uint8_t save_room, save_dir;
    uint16_t save_x, save_y;    /* respawn point (pixels) */
} progress_t;

typedef struct {
    ev_platform_t plat;
    int mode, next_mode;
    uint32_t frame;
    uint8_t buttons, pressed;   /* held, newly pressed this tick */
    progress_t p;
    int has_save;

    /* room */
    int room, prev_room;
    uint8_t tiles[RW * RH];
    uint8_t prev_tiles[RW * RH];
    int shut_closed, prev_shut_closed, has_shutters;
    int scroll_dx, scroll_dy, scroll_t, scroll_len;
    int entry_x, entry_y, entry_dir;
    int warp_room, warp_x, warp_y, warp_dir;
    int fade;                   /* 0..8 */

    /* hero */
    int32_t hx, hy;             /* 1/16 px, sprite top-left */
    int hdir, hstate, htimer, hiframes, hanim, hwalk;
    int hkbx, hkby, hkbt;
    int hold_sprite;
    int fall_t;
    int push_t, push_dir;
    int msg_cooldown;

    ent_t ents[MAX_ENTS];
    uint8_t order[MAX_ENTS];
    int norder;

    /* dialog */
    char dlg[256];
    int dlg_len, dlg_pos, dlg_page_start, dlg_done, dlg_return_mode;
    /* menus */
    int menu_sel, title_sel, over_sel;
    int pool_msg;
    int god;                    /* test harness: no damage */
    int quake;
    uint16_t pal[NUM_PAL];
    int pal_fade;
    int exit_requested;
} game_t;

extern game_t G;

/* game.c */
int flag_get(int f);
void flag_set(int f);
void apply_mods(void);
uint32_t tile_props_at_tile(int tx, int ty);
uint32_t props_at(int px, int py);
int tile_solid_for_hero(int tx, int ty);
int box_blocked(int x0, int y0, int x1, int y1, int flying);
void show_text(const char *s);
void show_text_id(int id);
void give_item(int item, int with_dialog);
void hero_damage(int amount, int fromx, int fromy);
void hit_tile(int tx, int ty, int by_bomb);
void autosave(void);
int rnd(int n);
int enemies_alive(void);
int hero_cx(void);
int hero_cy(void);
int dlg_layout(int start, int ls[3], int ll[3]);
void set_save_point(void);

/* entities.c */
ent_t *ent_spawn(int type, int px, int py);
void ents_clear(void);
void ents_update(void);
void ents_spawn_room(void);
void enemy_hurt(ent_t *e, int dmg, int fromx, int fromy, int stun_only);
void drop_loot(int px, int py, int boss);
int ent_overlaps(const ent_t *e, int x0, int y0, int x1, int y1);
void ent_box(const ent_t *e, int *x0, int *y0, int *x1, int *y1);
void sort_draw_order(void);

/* render.c */
void render_band(uint16_t *dst, int y0, int rows);
int text_width(const char *s, int scale);
void pal_update(void);

/* save.c */
void save_all(void);
int load_all(void);
void progress_new(void);
