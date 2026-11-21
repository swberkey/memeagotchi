/* Ember Vale - band renderer. Everything is drawn into a horizontal band
 * of the 320x240 frame, so the ESP32 only needs small DMA buffers. */
#include "ev_internal.h"

static uint16_t *B;      /* band buffer */
static int BY0, BY1;     /* band rows [BY0, BY1) */
static int quake_x, quake_y;

/* ---------------------------------------------------------- palette */
static uint16_t swap16(uint16_t c) { return (uint16_t)((c >> 8) | (c << 8)); }

static uint16_t fade565(uint16_t c, int level) /* level 0 = black, 8 = full */
{
    int r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31;
    r = r * level / 8; g = g * level / 8; b = b * level / 8;
    return (uint16_t)((r << 11) | (g << 5) | b);
}

static uint16_t out565(uint16_t c) { return G.plat.swap_bytes ? swap16(c) : c; }
static uint16_t in565(uint16_t c) { return G.plat.swap_bytes ? swap16(c) : c; }

void pal_update(void)
{
    int level = 8;
    if (G.mode == MODE_FADEOUT || G.mode == MODE_FADEIN) level = 8 - G.fade;
    if (level < 0) level = 0;
    if (level == G.pal_fade) return;
    G.pal_fade = level;
    for (int i = 0; i < NUM_PAL; i++) G.pal[i] = out565(fade565(pal565[i], level));
}

#define COL(name) (G.pal[PI_##name])

/* -------------------------------------------------------- primitives */
static void fill_rect(int x, int y, int w, int h, uint16_t c)
{
    int y0 = y < BY0 ? BY0 : y, y1 = y + h > BY1 ? BY1 : y + h;
    int x0 = x < 0 ? 0 : x, x1 = x + w > EV_SCREEN_W ? EV_SCREEN_W : x + w;
    for (int yy = y0; yy < y1; yy++) {
        uint16_t *row = B + (yy - BY0) * EV_SCREEN_W;
        for (int xx = x0; xx < x1; xx++) row[xx] = c;
    }
}

/* darken by 'amount' 0..8 of 8 */
static void dim_rect(int x, int y, int w, int h, int keep)
{
    int y0 = y < BY0 ? BY0 : y, y1 = y + h > BY1 ? BY1 : y + h;
    int x0 = x < 0 ? 0 : x, x1 = x + w > EV_SCREEN_W ? EV_SCREEN_W : x + w;
    for (int yy = y0; yy < y1; yy++) {
        uint16_t *row = B + (yy - BY0) * EV_SCREEN_W;
        for (int xx = x0; xx < x1; xx++) row[xx] = out565(fade565(in565(row[xx]), keep));
    }
}

static void draw_tile(int px, int py, int t)
{
    if (py + 16 <= BY0 || py >= BY1 || px + 16 <= 0 || px >= EV_SCREEN_W) return;
    const uint8_t *src = tile_px[t];
    int ty0 = BY0 - py > 0 ? BY0 - py : 0, ty1 = BY1 - py < 16 ? BY1 - py : 16;
    int tx0 = px < 0 ? -px : 0, tx1 = EV_SCREEN_W - px < 16 ? EV_SCREEN_W - px : 16;
    for (int ty = ty0; ty < ty1; ty++) {
        uint16_t *row = B + (py + ty - BY0) * EV_SCREEN_W + px;
        const uint8_t *s = src + ty * 16;
        for (int tx = tx0; tx < tx1; tx++) row[tx] = G.pal[s[tx]];
    }
}

/* flags: 1 flip h, 2 flip v, 4 white flash, 8 silhouette (shadow colour) */
static void draw_sprite(int spr, int px, int py, int flags)
{
    const sprite_t *s = &sprites[spr];
    int w = s->w, h = s->h;
    if (py + h <= BY0 || py >= BY1 || px + w <= 0 || px >= EV_SCREEN_W) return;
    const uint8_t *src = sprite_px + s->off;
    int sy0 = BY0 - py > 0 ? BY0 - py : 0, sy1 = BY1 - py < h ? BY1 - py : h;
    int sx0 = px < 0 ? -px : 0, sx1 = EV_SCREEN_W - px < w ? EV_SCREEN_W - px : w;
    uint16_t white = COL(white), shade = COL(shadow);
    for (int sy = sy0; sy < sy1; sy++) {
        int ry = (flags & 2) ? h - 1 - sy : sy;
        uint16_t *row = B + (py + sy - BY0) * EV_SCREEN_W + px;
        const uint8_t *srow = src + ry * w;
        for (int sx = sx0; sx < sx1; sx++) {
            uint8_t c = srow[(flags & 1) ? w - 1 - sx : sx];
            if (!c) continue;
            row[sx] = (flags & 8) ? shade : (flags & 4) && c != PI_ink ? white : G.pal[c];
        }
    }
}

static void draw_shadow(int cx, int by, int w)
{
    /* soft oval under a sprite */
    for (int dy = -1; dy <= 1; dy++) {
        int half = w / 2 - (dy ? 2 : 0);
        int y = by + dy;
        if (y < BY0 || y >= BY1) continue;
        uint16_t *row = B + (y - BY0) * EV_SCREEN_W;
        for (int x = cx - half; x < cx + half; x++)
            if (x >= 0 && x < EV_SCREEN_W) row[x] = out565(fade565(in565(row[x]), 5));
    }
}

static void draw_char(int x, int y, char ch, uint16_t c, int scale)
{
    if (ch < 32 || ch > 127) ch = '?';
    if (y + 7 * scale <= BY0 || y >= BY1) return;
    const uint8_t *g = font5x7[ch - 32];
    for (int r = 0; r < 7; r++)
        for (int col = 0; col < 5; col++)
            if (g[r] & (0x10 >> col)) fill_rect(x + col * scale, y + r * scale, scale, scale, c);
}

static void draw_text(int x, int y, const char *s, uint16_t c, int scale)
{
    for (; *s; s++, x += 6 * scale) draw_char(x, y, *s, c, scale);
}

static void draw_text_sh(int x, int y, const char *s, uint16_t c, int scale)
{
    draw_text(x + scale, y + scale, s, COL(ink), scale);
    draw_text(x, y, s, c, scale);
}

static void draw_text_n(int x, int y, const char *s, int n, uint16_t c)
{
    for (int i = 0; i < n && s[i]; i++, x += 6) draw_char(x, y, s[i], c, 1);
}

int text_width(const char *s, int scale)
{
    int n = 0;
    while (s[n]) n++;
    return n ? n * 6 * scale - scale : 0;
}

static void draw_center(int y, const char *s, uint16_t c, int scale)
{
    draw_text_sh((EV_SCREEN_W - text_width(s, scale)) / 2, y, s, c, scale);
}

static char *fmt_int(char *buf, int32_t v, int width)
{
    char tmp[12]; int n = 0;
    if (v < 0) v = 0;
    do { tmp[n++] = (char)('0' + v % 10); v /= 10; } while (v && n < 11);
    while (n < width) tmp[n++] = '0';
    for (int i = 0; i < n; i++) buf[i] = tmp[n - 1 - i];
    buf[n] = 0;
    return buf;
}

static void panel(int x, int y, int w, int h)
{
    fill_rect(x, y, w, h, COL(ink));
    fill_rect(x + 1, y + 1, w - 2, h - 2, COL(hud1));
    fill_rect(x + 2, y + 2, w - 4, h - 4, COL(hud));
    fill_rect(x + 3, y + 3, w - 6, 1, COL(hud2));
}

/* ------------------------------------------------------------ world */
static int tile_visual(int room, const uint8_t *tiles, int i, int shut_closed)
{
    int t = tiles[i];
    if ((tile_props[t] & TP_SHUTTER) && !shut_closed) t = rooms[room].ground;
    if ((G.frame >> 5) & 1) t = tile_anim[t];
    return t;
}

static void draw_room_tiles(int room, const uint8_t *tiles, int shut_closed, int ox, int oy)
{
    int ty0 = (BY0 - PLAY_Y - oy) >> 4, ty1 = (BY1 - PLAY_Y - oy + 15) >> 4;
    if (ty0 < 0) ty0 = 0;
    if (ty1 > RH) ty1 = RH;
    for (int ty = ty0; ty < ty1; ty++)
        for (int tx = 0; tx < RW; tx++) {
            int px = tx * 16 + ox;
            if (px <= -16 || px >= EV_SCREEN_W) continue;
            draw_tile(px, PLAY_Y + ty * 16 + oy, tile_visual(room, tiles, ty * RW + tx, shut_closed));
        }
    const room_t *r = &rooms[room];
    if (r->meme_x != 255) {
        int mx = r->meme_x * 16 + ox, my = PLAY_Y + r->meme_y * 16 + oy;
        int lv = G.pal_fade < 0 ? 8 : G.pal_fade;
        for (int y = 0; y < MEME_H; y++) {
            int sy = my + y;
            if (sy < BY0 || sy >= BY1 || sy < PLAY_Y) continue;
            uint16_t *row = B + (sy - BY0) * EV_SCREEN_W;
            for (int x = 0; x < MEME_W; x++) {
                int sx = mx + x;
                if (sx >= 0 && sx < EV_SCREEN_W) row[sx] = out565(fade565(meme565[y * MEME_W + x], lv));
            }
        }
    }
}

static int hero_sprite(int *flags)
{
    int f = (G.hanim >> 3) & 1;
    if (!G.hwalk && G.mode == MODE_PLAY) f = 0;
    *flags = 0;
    switch (G.hdir) {
    case D_UP: return SPR_HERO_UP0 + f;
    case D_LEFT: *flags = 1; return SPR_HERO_SIDE0 + f;
    case D_RIGHT: return SPR_HERO_SIDE0 + f;
    default: return SPR_HERO_DOWN0 + f;
    }
}

static void draw_hero(int ox, int oy)
{
    int px = (G.hx >> 4) + ox, py = (G.hy >> 4) + PLAY_Y + oy;
    if (G.mode == MODE_FALL) {
        if (G.fall_t < 24 && (G.fall_t & 2)) draw_sprite(SPR_HERO_DOWN0, px, py + G.fall_t / 4, 8);
        return;
    }
    if (G.hiframes && (G.hiframes & 4) && G.hstate != H_HURT) return; /* blink */
    int flags;
    int spr = hero_sprite(&flags);
    if (G.hstate == H_HURT) flags |= 4;
    /* Floating teal-and-lavender companion mascot trailing behind the hero */
    if (G.mode == MODE_PLAY || G.mode == MODE_DIALOG || G.mode == MODE_SCROLL) {
        int cdx = (G.hdir == D_LEFT) ? 14 : (G.hdir == D_RIGHT) ? -14 : 13;
        int cdy = (G.hdir == D_UP) ? 8 : -7;
        int bob = ((G.frame >> 4) & 1) ? -1 : 0;
        int cx = px + cdx, cy = py + cdy + bob;
        draw_shadow(cx + 8, cy + 16, 8);
        draw_sprite(SPR_COMPANION0 + ((G.frame >> 4) & 1), cx, cy, G.hdir == D_LEFT ? 1 : 0);
    }
    int hh = sprites[spr].h;
    int hy = py - (hh - 16);
    draw_shadow(px + 8, py + 15, 12);
    int sword = G.hstate == H_ATTACK && G.htimer < 14;
    int ext = sword ? (G.htimer < 3 ? 6 : 0) : 0;
    if (sword && G.hdir == D_UP) draw_sprite(SPR_SWORD_V, px + 1, hy - 10 + ext, 0);
    if (G.hstate == H_HOLD) spr = SPR_HERO_DOWN0;
    draw_sprite(spr, px, hy, flags);
    if (sword) {
        if (G.hdir == D_DOWN) draw_sprite(SPR_SWORD_V, px - 1, py + 12 - ext, 2);
        if (G.hdir == D_RIGHT) draw_sprite(SPR_SWORD_H, px + 12 - ext, py + 1, 0);
        if (G.hdir == D_LEFT) draw_sprite(SPR_SWORD_H, px - 12 + ext, py + 1, 1);
    }
    if (G.hstate == H_HOLD) draw_sprite(G.hold_sprite, px, hy - 14, 0);
}

static const int16_t NPC_BASE[] = {
    [NPC_ELDER] = SPR_NPC_ELDER_DOWN0, [NPC_SHOPKEEP] = SPR_NPC_SHOPKEEP_DOWN0, [NPC_KID] = SPR_NPC_KID_DOWN0,
    [NPC_FISHER] = SPR_NPC_FISHER_DOWN0, [NPC_GARDENER] = SPR_NPC_GARDENER_DOWN0, [NPC_GRANNY] = SPR_NPC_GRANNY_DOWN0,
    [NPC_TAMSIN] = SPR_NPC_KID2_DOWN0,
};

static int dir4_sprite(int base, int dir, int f, int *flags, int two_up)
{
    *flags = 0;
    switch (dir) {
    case D_UP: return base + 2 + (two_up ? f : 0);
    case D_LEFT: *flags = 1; return base + (two_up ? 4 + f : 3);
    case D_RIGHT: return base + (two_up ? 4 + f : 3);
    default: return base + f;
    }
}

static void draw_entity(const ent_t *e, int ox, int oy)
{
    int px = (e->x >> 4) + ox, py = (e->y >> 4) + PLAY_Y + oy;
    int f = (e->anim >> 4) & 1, flags = 0, spr = -1;
    int shadow = 1;
    switch (e->type) {
    case SP_BLOB: spr = SPR_BLOB0 + (e->state ? 1 : f); break;
    case SP_BLOB_RED: spr = SPR_BLOBR0 + (e->state ? 1 : f); break;
    case SP_BAT: spr = SPR_BAT0 + ((e->anim >> 3) & 1); py -= 6; break;
    case SP_BEETLE:
        if (e->dir < 2) { spr = SPR_BEETLEV0 + f; flags = e->dir == D_DOWN ? 2 : 0; }
        else { spr = SPR_BEETLEH0 + f; flags = e->dir == D_LEFT ? 1 : 0; }
        break;
    case SP_CRAB: spr = SPR_CRAB0 + ((e->anim >> 3) & 1); break;
    case SP_GHOST: spr = SPR_GHOST0 + f; flags = e->dir == D_LEFT ? 1 : 0; py -= 3 + ((e->anim >> 4) & 1); shadow = 0; break;
    case SP_SHROOM: spr = SPR_SHROOM0 + (e->timer < 20 ? 1 : 0); break;
    case SP_SKELETON: spr = dir4_sprite(SPR_SKEL_DOWN0, e->dir, f, &flags, 1); break;
    case SP_KNIGHT: spr = dir4_sprite(SPR_KNIGHT_DOWN0, e->dir, f, &flags, 1); break;
    case SP_KNIGHT2: spr = dir4_sprite(SPR_KNIGHT2_DOWN0, e->dir, f, &flags, 1); break;
    case SP_THORNBACK:
        spr = SPR_THORNBACK0 + (e->state == 2 ? ((e->anim >> 2) & 1) : f);
        if (e->state == 1) px += (e->anim & 2) ? 1 : -1;
        if (e->state == 3 && (e->anim & 8)) flags |= 4;
        break;
    case SP_WISP: spr = SPR_WISP0 + ((e->anim >> 3) & 1); shadow = 2; if (e->state == 1) flags |= (e->anim & 4) ? 4 : 0; break;
    case E_NPC: {
        int moving = e->state && G.mode == MODE_PLAY;
        spr = dir4_sprite(NPC_BASE[e->arg], e->dir, moving ? f : 0, &flags, 0);
        if (e->dir == D_DOWN && !moving) spr = NPC_BASE[e->arg] + ((e->anim >> 5) & 1 ? 1 : 0) * 0;
        break;
    }
    case E_FAIRY: spr = SPR_FAIRY0 + ((e->anim >> 2) & 1); shadow = 2; py -= 6; break;
    case E_HEARTC: spr = SPR_HEARTC; break;
    case E_PICK_HEART: spr = SPR_HEART; break;
    case E_PICK_GOLD: spr = SPR_COIN0 + ((e->anim >> 3) & 1); break;
    case E_PICK_SILVER: spr = SPR_SCOIN0 + ((e->anim >> 3) & 1); break;
    case E_PICK_RED: spr = SPR_RCOIN0 + ((e->anim >> 3) & 1); break;
    case E_PICK_BOMBS: spr = SPR_BOMB0; break;
    case E_PICK_ARROWS: spr = SPR_ARROW_V; break;
    case E_PICK_CRYSTAL: spr = e->arg == 1 ? SPR_SUN : SPR_MOON; py -= 2 + ((e->anim >> 4) & 1) * 2; break;
    case E_SHOPITEM: {
        static const int16_t ICON[] = {[IT_BOMBS] = SPR_BOMB0, [IT_ARROWS] = SPR_ARROW_V, [IT_REFILL] = SPR_HEART, [IT_CONTAINER] = SPR_HEARTC};
        static const int16_t PRICE[] = {[IT_BOMBS] = 20, [IT_ARROWS] = 15, [IT_REFILL] = 10, [IT_CONTAINER] = 150};
        spr = ICON[e->arg];
        draw_sprite(spr, px, py - 2, 0);
        char b[8];
        fmt_int(b, PRICE[e->arg], 1);
        int w = text_width(b, 1);
        fill_rect(px + 8 - w / 2 - 2, py + 15, w + 4, 9, COL(ink));
        draw_text(px + 8 - w / 2, py + 16, b, COL(ye0), 1);
        return;
    }
    case E_BOMB: spr = SPR_BOMB0 + (e->timer > 60 ? (e->timer >> 2) & 1 : 0); break;
    case E_EXPLOSION: spr = SPR_EXPLODE0 + (e->timer / 7 > 2 ? 2 : e->timer / 7); shadow = 0; break;
    case E_ARROW:
        shadow = 0;
        if (e->dir < 2) { spr = SPR_ARROW_V; flags = e->dir == D_DOWN ? 2 : 0; }
        else { spr = SPR_ARROW_H; flags = e->dir == D_LEFT ? 1 : 0; }
        break;
    case E_BOOMERANG: spr = SPR_BOOMER0 + ((e->anim >> 1) & 3); shadow = 0; break;
    case E_SPORE: spr = SPR_SPORE; shadow = 0; break;
    case E_FIREBALL: spr = SPR_FIRE0 + ((e->anim >> 2) & 1); shadow = 0; break;
    case E_POOF: spr = SPR_POOF0 + (e->timer >= 8); shadow = 0; break;
    case E_SPARKLE: spr = SPR_SPARK0 + ((e->timer >> 2) & 1); shadow = 0; break;
    default: return;
    }
    if (spr < 0) return;
    if (IS_PICKUP(e->type) && e->arg == 0 && e->type != E_HEARTC && e->type != E_PICK_CRYSTAL && e->timer > 450 && (e->timer & 4)) return;
    if (IS_ENEMY(e->type) && e->iframes && (e->iframes & 2)) flags |= 4;
    if (IS_ENEMY(e->type) && e->stun && (e->stun & 8)) flags |= 4;
    int w = sprites[spr].w, h = sprites[spr].h;
    int ew = e->w ? e->w : 16, eh = e->h ? e->h : 16;
    int dx = px - (w - ew) / 2;
    int dy = py - (h - eh);
    if (shadow == 1) draw_shadow(px + ew / 2, (e->y >> 4) + PLAY_Y + oy + eh - 1, ew - 4);
    if (shadow == 2) draw_shadow(px + ew / 2, py + eh + 5, ew / 2);
    draw_sprite(spr, dx, dy, flags);
}

static void draw_world(int ox, int oy)
{
    /* play-area clip: never draw over the HUD */
    int saved0 = BY0;
    if (BY0 < PLAY_Y) {
        if (BY1 <= PLAY_Y) return;
        B += (PLAY_Y - BY0) * EV_SCREEN_W; BY0 = PLAY_Y;
    }
    if (G.mode == MODE_SCROLL) {
        int len = G.scroll_len, t = G.scroll_t;
        int nx = G.scroll_dx * EV_SCREEN_W * (len - t) / len;
        int ny = G.scroll_dy * (RH * 16) * (len - t) / len;
        int px = nx - G.scroll_dx * EV_SCREEN_W, py = ny - G.scroll_dy * RH * 16;
        draw_room_tiles(G.prev_room, G.prev_tiles, G.prev_shut_closed, px, py);
        draw_room_tiles(G.room, G.tiles, G.shut_closed, nx, ny);
        draw_hero(nx, ny);
    } else {
        draw_room_tiles(G.room, G.tiles, G.shut_closed, ox, oy);
        int hero_bottom = (G.hy >> 4) + 16;
        int hero_drawn = 0;
        int title = G.mode == MODE_TITLE;
        for (int i = 0; i < G.norder; i++) {
            const ent_t *e = &G.ents[G.order[i]];
            if (e->type == E_NONE) continue;
            if (!hero_drawn && !title && (e->y >> 4) + e->h > hero_bottom) { draw_hero(ox, oy); hero_drawn = 1; }
            draw_entity(e, ox, oy);
        }
        if (!hero_drawn && !title) draw_hero(ox, oy);
    }
    if (saved0 < PLAY_Y) { B -= (PLAY_Y - saved0) * EV_SCREEN_W; BY0 = saved0; }
}

/* ---------------------------------------------------------------- HUD */
static void draw_hud(void)
{
    if (BY0 >= PLAY_Y) return;
    fill_rect(0, 0, EV_SCREEN_W, PLAY_Y, COL(hud));
    fill_rect(0, 0, EV_SCREEN_W, 1, COL(hud2));
    fill_rect(0, PLAY_Y - 2, EV_SCREEN_W, 1, COL(hud1));
    fill_rect(0, PLAY_Y - 1, EV_SCREEN_W, 1, COL(ink));
    int mh = G.p.max_hearts;
    for (int i = 0; i < mh; i++) {
        int hp = G.p.hp - i * 2;
        int spr = hp >= 2 ? SPR_I8_HEART_FULL : hp == 1 ? SPR_I8_HEART_HALF : SPR_I8_HEART_EMPTY;
        int x = 3 + (i % 10) * 9, y = i < 10 ? 0 : 8;
        if (mh <= 10) y = 4;
        draw_sprite(spr, x, y, 0);
    }
    /* selected item */
    int bx = 98;
    fill_rect(bx, 0, 16, 15, COL(ink));
    fill_rect(bx + 1, 1, 14, 13, COL(hud1));
    int spr = -1;
    if (G.p.sel == 0 && G.p.has_bombs) spr = SPR_BOMB0;
    if (G.p.sel == 1 && G.p.has_bow) spr = SPR_BOW;
    if (G.p.sel == 2 && G.p.has_boomerang) spr = SPR_BOOMER0;
    if (spr >= 0) draw_sprite(spr, bx, -1, 0);
    char b[12];
    draw_sprite(SPR_I8_COIN, 122, 4, 0);
    draw_text(132, 5, fmt_int(b, G.p.coins, 3), COL(ye0), 1);
    int x = 170;
    if (G.p.has_bombs) {
        draw_sprite(SPR_I8_BOMB, x, 4, 0);
        draw_text(x + 10, 5, fmt_int(b, G.p.bombs, 2), COL(white), 1);
        x += 30;
    }
    if (G.p.has_bow) {
        draw_sprite(SPR_I8_ARROW, x, 4, 0);
        draw_text(x + 10, 5, fmt_int(b, G.p.arrows, 2), COL(white), 1);
        x += 30;
    }
    int d = rooms[G.room].dungeon;
    if (d) {
        draw_sprite(SPR_I8_KEY, x, 4, 0);
        draw_text(x + 10, 5, fmt_int(b, G.p.keys[d], 1), COL(white), 1);
        x += 22;
        if (flag_get(d == 1 ? FLAG_BOSSKEY1 : FLAG_BOSSKEY2)) draw_sprite(SPR_I8_BOSSKEY, x, 4, 0);
    }
    if (flag_get(FLAG_CRYSTAL1)) draw_sprite(SPR_SUN, 284, 0, 0);
    if (flag_get(FLAG_CRYSTAL2)) draw_sprite(SPR_MOON, 302, 0, 0);
}

/* ------------------------------------------------------------ overlays */
static void draw_dialog(void)
{
    int top = (G.hy >> 4) > 150 ? 22 : 170;
    if (BY1 <= top || BY0 >= top + 62) return;
    panel(6, top, 308, 62);
    int ls[3], ll[3];
    dlg_layout(G.dlg_page_start, ls, ll);
    for (int i = 0; i < 3; i++) {
        int n = ll[i];
        if (ls[i] + n > G.dlg_pos) n = G.dlg_pos - ls[i];
        if (n > 0) {
            draw_text_n(15, top + 10 + i * 16, G.dlg + ls[i], n, COL(ink));
            draw_text_n(14, top + 9 + i * 16, G.dlg + ls[i], n, COL(white));
        }
    }
    int page_end = dlg_layout(G.dlg_page_start, ls, ll);
    if (G.dlg_pos >= page_end && (G.frame & 16))
        draw_text(300, top + 50, page_end < G.dlg_len ? "V" : "*", COL(ye0), 1);
}

static void draw_title(void)
{
    dim_rect(0, 0, EV_SCREEN_W, EV_SCREEN_H, 4);
    draw_center(40, "EMBER VALE", COL(ye0), 4);
    draw_center(78, "A TALE OF SUN AND MOON", COL(white), 1);
    static const char *opts[3] = {"CONTINUE", "NEW GAME", "EXIT"};
    int first = G.has_save ? 0 : 1;
    for (int i = first; i < 3; i++) {
        int y = 120 + (i - first) * 22;
        int sel = G.title_sel == i - first;
        draw_center(y, opts[i], sel ? COL(ye0) : COL(sv1), 2);
        if (sel && (G.frame & 16)) draw_text_sh(96, y, ">", COL(ye0), 2);
    }
    draw_center(206, "X SELECT   ARROWS MOVE", COL(sv1), 1);
    if (G.has_save) {
        char b[24], n[8];
        memcpy(b, "WALLET ", 7);
        fmt_int(n, G.p.coins, 1);
        int k = 7;
        for (int i = 0; n[i]; i++) b[k++] = n[i];
        b[k] = 0;
        memcpy(b + k, " COINS", 7);
        draw_center(222, b, COL(ye1), 1);
    }
}

static void slot(int x, int y, int spr, int owned, int selected, int cursor)
{
    fill_rect(x, y, 28, 28, cursor && (G.frame & 16) ? COL(ye0) : COL(ink));
    fill_rect(x + 2, y + 2, 24, 24, selected ? COL(hud2) : COL(hud1));
    if (owned) draw_sprite(spr, x + 6, y + 6, 0);
}

static void draw_menu(void)
{
    if (BY1 <= 24 || BY0 >= 232) return;
    panel(16, 24, 288, 208);
    draw_text_sh(28, 34, "ITEMS", COL(ye0), 2);
    static const int16_t IS[3] = {SPR_BOMB0, SPR_BOW, SPR_BOOMER0};
    static const char *IN[3] = {"BOMBS", "BOW", "BOOMERANG"};
    int own[3] = {G.p.has_bombs, G.p.has_bow, G.p.has_boomerang};
    for (int i = 0; i < 3; i++) slot(30 + i * 36, 56, IS[i], own[i], G.p.sel == i, G.menu_sel == i);
    if (G.menu_sel < 3) draw_text(30, 90, own[G.menu_sel] ? IN[G.menu_sel] : "---", COL(white), 1);

    char b[16];
    draw_text_sh(150, 34, "JOURNEY", COL(ye0), 2);
    draw_sprite(SPR_I8_HEART_FULL, 152, 58, 0);
    draw_text(164, 59, fmt_int(b, G.p.max_hearts, 1), COL(white), 1);
    draw_text(178, 59, "HEARTS", COL(sv1), 1);
    draw_sprite(SPR_I8_COIN, 152, 72, 0);
    draw_text(164, 73, fmt_int(b, G.p.coins, 1), COL(ye0), 1);
    draw_text(206, 73, "IN WALLET", COL(sv1), 1);
    draw_sprite(flag_get(FLAG_CRYSTAL1) ? SPR_SUN : SPR_SUN, 150, 86, flag_get(FLAG_CRYSTAL1) ? 0 : 8);
    draw_sprite(SPR_MOON, 170, 86, flag_get(FLAG_CRYSTAL2) ? 0 : 8);
    draw_text(192, 91, "CRYSTALS", COL(sv1), 1);

    /* overworld map */
    draw_text_sh(28, 110, "MAP", COL(ye0), 2);
    const area_t *ow = &areas[AREA_OVERWORLD];
    int cur = rooms[G.room].area == AREA_OVERWORLD ? G.room : -1;
    for (int cy = 0; cy < ow->h; cy++)
        for (int cx = 0; cx < ow->w; cx++) {
            int id = ow->cells[cy * ow->w + cx];
            int x = 30 + cx * 18, y = 130 + cy * 12;
            int seen = id >= 0 && (G.p.visited[id >> 3] >> (id & 7) & 1);
            fill_rect(x, y, 17, 11, seen ? COL(g1) : COL(hud1));
            if (id == cur && (G.frame & 16)) fill_rect(x + 6, y + 3, 5, 5, COL(re0));
        }
    if (cur < 0) draw_text(30, 182, rooms[G.room].name, COL(white), 1);
    else draw_text(30, 182, rooms[G.room].name, COL(white), 1);

    draw_text(150, 130, "X SELECT ITEM", COL(sv1), 1);
    draw_text(150, 142, "START BACK TO GAME", COL(sv1), 1);
    draw_text(150, 154, "COINS GO HOME WITH YOU", COL(sv1), 1);

    static const char *OPT[2] = {"SAVE", "SAVE & EXIT"};
    for (int i = 0; i < 2; i++) {
        int x = 150 + i * 60, y = 200;
        int sel = G.menu_sel == 3 + i;
        draw_text_sh(x, y, OPT[i], sel ? COL(ye0) : COL(white), 1);
        if (sel && (G.frame & 16)) draw_text(x - 8, y, ">", COL(ye0), 1);
    }
}

static void draw_gameover(void)
{
    dim_rect(0, PLAY_Y, EV_SCREEN_W, EV_SCREEN_H - PLAY_Y, 2);
    draw_center(80, "YOU FELL", COL(re0), 3);
    static const char *opts[2] = {"CONTINUE", "SAVE & EXIT"};
    for (int i = 0; i < 2; i++) {
        int sel = G.over_sel == i;
        draw_center(130 + i * 22, opts[i], sel ? COL(ye0) : COL(sv1), 2);
    }
}

static void draw_ending(void)
{
    dim_rect(0, PLAY_Y, EV_SCREEN_W, EV_SCREEN_H - PLAY_Y, 3);
    draw_center(50, "THE VALE SHINES", COL(ye0), 3);
    draw_center(90, "SUN AND MOON ARE HOME AGAIN.", COL(white), 1);
    draw_center(104, "WILLOWMERE IS SAFE. THANK YOU!", COL(white), 1);
    char b[48], n[12];
    int k = 0;
    const char *a = "COINS EARNED ";
    while (*a) b[k++] = *a++;
    fmt_int(n, G.p.lifetime_coins, 1);
    for (int i = 0; n[i]; i++) b[k++] = n[i];
    b[k] = 0;
    draw_center(130, b, COL(ye1), 1);
    k = 0; a = "TIME ";
    while (*a) b[k++] = *a++;
    uint32_t s = G.p.play_frames / 60;
    fmt_int(n, (int32_t)(s / 3600), 1); for (int i = 0; n[i]; i++) b[k++] = n[i];
    b[k++] = ':';
    fmt_int(n, (int32_t)(s / 60 % 60), 2); for (int i = 0; n[i]; i++) b[k++] = n[i];
    b[k] = 0;
    draw_center(144, b, COL(sv1), 1);
    draw_center(180, "PRESS X TO KEEP EXPLORING", COL(sv1), 1);
}

/* --------------------------------------------------------------- band */
void render_band(uint16_t *dst, int y0, int rows)
{
    pal_update();
    B = dst; BY0 = y0; BY1 = y0 + rows;
    if (BY1 > EV_SCREEN_H) BY1 = EV_SCREEN_H;
    quake_x = quake_y = 0;
    if (G.quake && G.mode == MODE_PLAY) { quake_x = (G.frame & 2) ? 2 : -2; quake_y = (G.frame & 4) ? 1 : -1; }
    if (G.quake && quake_x) fill_rect(0, 0, EV_SCREEN_W, EV_SCREEN_H, COL(black));
    draw_world(quake_x, quake_y);
    if (G.mode != MODE_TITLE) draw_hud();
    else fill_rect(0, 0, EV_SCREEN_W, PLAY_Y, COL(ink));
    switch (G.mode) {
    case MODE_TITLE: draw_title(); break;
    case MODE_DIALOG: draw_dialog(); break;
    case MODE_MENU: draw_menu(); break;
    case MODE_GAMEOVER: draw_gameover(); break;
    case MODE_ENDING: draw_ending(); break;
    default: break;
    }
}
