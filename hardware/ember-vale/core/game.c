/* Ember Vale - game flow, hero, rooms, items, dialog and menus. */
#include "ev_internal.h"

game_t G;
const int8_t DIR_DX[4] = {0, 0, -1, 1};
const int8_t DIR_DY[4] = {1, -1, 0, 0};

static uint32_t rng_state = 0x1234567u;
int rnd(int n)
{
    rng_state = rng_state * 1103515245u + 12345u;
    return n > 0 ? (int)((rng_state >> 16) % (uint32_t)n) : 0;
}

/* ------------------------------------------------------------------ flags */
int flag_get(int f)
{
    if (f < 0 || f >= 256) return 0;
    return (G.p.flags[f >> 3] >> (f & 7)) & 1;
}

void flag_set(int f)
{
    if (f < 0 || f >= 256) return;
    G.p.flags[f >> 3] |= (uint8_t)(1 << (f & 7));
    apply_mods();
}

void apply_mods(void)
{
    const room_t *r = &rooms[G.room];
    for (int i = 0; i < r->nmods; i++) {
        const mod_t *m = &r->mods[i];
        if (flag_get(m->flag)) G.tiles[m->y * RW + m->x] = m->tile;
    }
}

/* ------------------------------------------------------------------ tiles */
static int neighbour_room(int dx, int dy)
{
    const room_t *r = &rooms[G.room];
    const area_t *a = &areas[r->area];
    int cx = r->cx + dx, cy = r->cy + dy;
    if (cx < 0 || cy < 0 || cx >= a->w || cy >= a->h) return -1;
    return a->cells[cy * a->w + cx];
}

uint32_t tile_props_at_tile(int tx, int ty)
{
    if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return 0;
    uint32_t p = tile_props[G.tiles[ty * RW + tx]];
    if ((p & TP_SHUTTER) && !G.shut_closed) p &= ~(TP_SOLID | TP_SHUTTER);
    return p;
}

uint32_t props_at(int px, int py)
{
    return tile_props_at_tile(px >> 4, py >> 4);
}

int tile_solid_for_hero(int tx, int ty)
{
    if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) {
        int dx = tx < 0 ? -1 : (tx >= RW ? 1 : 0);
        int dy = ty < 0 ? -1 : (ty >= RH ? 1 : 0);
        if (dx && dy) return 1;
        return neighbour_room(dx, dy) < 0;
    }
    uint32_t p = tile_props_at_tile(tx, ty);
    return (p & (TP_SOLID | TP_WATER)) != 0;
}

/* mode: 0 hero, 1 walking enemy, 2 flying enemy */
int box_blocked(int x0, int y0, int x1, int y1, int mode)
{
    if (mode != 0) {
        if (x0 < 0 || y0 < 0 || x1 >= RW * 16 || y1 >= RH * 16) return 1;
        if (mode == 2) return 0;
    }
    for (int ty = y0 >> 4; ty <= (y1 >> 4); ty++)
        for (int tx = x0 >> 4; tx <= (x1 >> 4); tx++) {
            if (mode == 0) {
                if (tile_solid_for_hero(tx, ty)) return 1;
            } else {
                uint32_t p = tile_props_at_tile(tx, ty);
                if (p & (TP_SOLID | TP_WATER | TP_PIT | TP_SPIKE | TP_WARP | TP_POOL)) return 1;
            }
        }
    return 0;
}

int hero_cx(void) { return (G.hx >> 4) + 8; }
int hero_cy(void) { return (G.hy >> 4) + 12; }

static void hero_box_at(int32_t hx, int32_t hy, int *x0, int *y0, int *x1, int *y1)
{
    *x0 = (hx >> 4) + 3; *y0 = (hy >> 4) + 8;
    *x1 = *x0 + 9; *y1 = *y0 + 7;
}

static int hero_blocked_at(int32_t hx, int32_t hy)
{
    int x0, y0, x1, y1;
    hero_box_at(hx, hy, &x0, &y0, &x1, &y1);
    if (box_blocked(x0, y0, x1, y1, 0)) return 1;
    for (int i = 0; i < MAX_ENTS; i++) {
        ent_t *e = &G.ents[i];
        if (e->type == E_NPC) {
            int ex = e->x >> 4, ey = e->y >> 4;
            if (x1 >= ex + 2 && x0 <= ex + 13 && y1 >= ey + 7 && y0 <= ey + 15) return 1;
        }
    }
    return 0;
}

/* --------------------------------------------------------------- dialog */
void show_text(const char *s)
{
    int n = 0;
    while (s[n] && n < (int)sizeof(G.dlg) - 1) { G.dlg[n] = s[n]; n++; }
    G.dlg[n] = 0;
    G.dlg_len = n;
    G.dlg_pos = 0;
    G.dlg_page_start = 0;
    if (G.mode != MODE_DIALOG) G.dlg_return_mode = G.mode == MODE_ENDING ? MODE_PLAY : MODE_PLAY;
    G.mode = MODE_DIALOG;
}

void show_text_id(int id) { show_text(texts[id]); }

/* Wraps text into lines of at most 50 chars; returns the index where the
 * page starting at 'start' ends (3 lines). Fills line starts/lengths. */
int dlg_layout(int start, int ls[3], int ll[3])
{
    int pos = start;
    for (int line = 0; line < 3; line++) {
        while (G.dlg[pos] == ' ') pos++;
        ls[line] = pos; ll[line] = 0;
        if (!G.dlg[pos]) continue;
        int end = pos, last_space = -1;
        while (G.dlg[end] && end - pos < 50) {
            if (G.dlg[end] == ' ') last_space = end;
            end++;
        }
        if (G.dlg[end] && last_space > pos) end = last_space;
        ll[line] = end - pos;
        pos = end;
    }
    while (G.dlg[pos] == ' ') pos++;
    return pos;
}

static void update_dialog(void)
{
    int ls[3], ll[3];
    int page_end = dlg_layout(G.dlg_page_start, ls, ll);
    if (G.dlg_pos < page_end) {
        G.dlg_pos += 2;
        if (G.dlg_pos > page_end) G.dlg_pos = page_end;
    }
    if (G.pressed & (EV_BTN_X | EV_BTN_O | EV_BTN_START)) {
        if (G.dlg_pos < page_end) {
            G.dlg_pos = page_end;
        } else if (page_end < G.dlg_len) {
            G.dlg_page_start = page_end;
            G.dlg_pos = page_end;
        } else {
            G.mode = G.dlg_return_mode;
            if (G.hstate == H_HOLD) G.hstate = H_NORMAL;
            if (G.p.complete == 1) { G.p.complete = 2; G.mode = MODE_ENDING; }
        }
    }
}

/* ------------------------------------------------------------- rooms */
static void load_room(int id)
{
    G.room = id;
    memcpy(G.tiles, rooms[id].tiles, RW * RH);
    apply_mods();
    G.shut_closed = 0;
    G.has_shutters = 0;
    for (int i = 0; i < RW * RH; i++)
        if (tile_props[G.tiles[i]] & TP_SHUTTER) G.has_shutters = 1;
    G.p.visited[id >> 3] |= (uint8_t)(1 << (id & 7));
}

static void room_entered(void)
{
    ents_clear();
    ents_spawn_room();
    G.entry_x = G.hx; G.entry_y = G.hy; G.entry_dir = G.hdir;
    G.pool_msg = 0;
}

static void start_scroll(int dx, int dy)
{
    int n = neighbour_room(dx, dy);
    if (n < 0) return;
    memcpy(G.prev_tiles, G.tiles, sizeof G.tiles);
    G.prev_room = G.room;
    G.prev_shut_closed = G.shut_closed;
    ents_clear();
    load_room(n);
    G.hx -= dx * RW * 16 * FP;
    G.hy -= dy * RH * 16 * FP;
    G.scroll_dx = dx; G.scroll_dy = dy;
    G.scroll_t = 0;
    G.scroll_len = dx ? 40 : 28;
    G.mode = MODE_SCROLL;
    G.hstate = H_NORMAL;
}

static void update_scroll(void)
{
    G.scroll_t++;
    int32_t tx = G.hx, ty = G.hy;
    if (G.scroll_dx > 0) tx = -2 * FP;
    if (G.scroll_dx < 0) tx = 306 * FP;
    if (G.scroll_dy > 0) ty = -7 * FP;
    if (G.scroll_dy < 0) ty = 207 * FP;
    int left = G.scroll_len - G.scroll_t + 1;
    if (left < 1) left = 1;
    G.hx += (tx - G.hx) / left;
    G.hy += (ty - G.hy) / left;
    G.hanim++;
    if (G.scroll_t >= G.scroll_len) {
        G.hx = tx; G.hy = ty;
        G.mode = MODE_PLAY;
        room_entered();
    }
}

void set_save_point(void)
{
    G.p.save_room = (uint8_t)G.room;
    G.p.save_x = (uint16_t)(G.hx / FP);
    G.p.save_y = (uint16_t)(G.hy / FP);
    G.p.save_dir = (uint8_t)G.hdir;
}

static void do_warp(void)
{
    load_room(G.warp_room);
    G.hx = G.warp_x * FP;
    G.hy = G.warp_y * FP;
    G.hdir = G.warp_dir;
    G.hstate = H_NORMAL;
    room_entered();
    set_save_point();
    autosave();
}

void autosave(void)
{
    save_all();
}

int enemies_alive(void)
{
    int n = 0;
    for (int i = 0; i < MAX_ENTS; i++)
        if (IS_ENEMY(G.ents[i].type)) n++;
    return n;
}

static int hero_on_shutter(void)
{
    int x0, y0, x1, y1;
    hero_box_at(G.hx, G.hy, &x0, &y0, &x1, &y1);
    x0 -= 2; y0 -= 4; x1 += 2; y1 += 2;
    for (int ty = y0 >> 4; ty <= (y1 >> 4); ty++)
        for (int tx = x0 >> 4; tx <= (x1 >> 4); tx++)
            if (tx >= 0 && ty >= 0 && tx < RW && ty < RH && (tile_props[G.tiles[ty * RW + tx]] & TP_SHUTTER)) return 1;
    return 0;
}

/* ------------------------------------------------------------- items */
static const int PRICES[] = {[IT_BOMBS] = 20, [IT_ARROWS] = 15, [IT_REFILL] = 10, [IT_CONTAINER] = 150};

void give_item(int item, int with_dialog)
{
    int d = rooms[G.room].dungeon;
    int text = -1, spr = SPR_KEY;
    switch (item) {
    case IT_KEY: G.p.keys[d]++; text = TXT_GET_KEY; spr = SPR_KEY; break;
    case IT_BOSSKEY: text = TXT_GET_BOSSKEY; spr = SPR_BOSSKEY; break;
    case IT_BOMBBAG:
        G.p.max_bombs = 20; G.p.bombs = (uint8_t)(G.p.bombs + 8 > 20 ? 20 : G.p.bombs + 8);
        if (!G.p.has_bombs) G.p.sel = 0;
        G.p.has_bombs = 1; text = TXT_GET_BOMBBAG; spr = SPR_BOMBBAG; break;
    case IT_BOW:
        G.p.has_bow = 1; G.p.arrows = (uint8_t)(G.p.arrows + 10 > G.p.max_arrows ? G.p.max_arrows : G.p.arrows + 10);
        G.p.sel = 1; text = TXT_GET_BOW; spr = SPR_BOW; break;
    case IT_BOOMERANG:
        G.p.has_boomerang = 1; if (!G.p.has_bombs && !G.p.has_bow) G.p.sel = 2;
        text = TXT_GET_BOOMERANG; spr = SPR_BOOMER0; break;
    case IT_PURSE: G.p.coins += 50; G.p.lifetime_coins += 50; text = TXT_GET_PURSE; spr = SPR_PURSE; break;
    case IT_CONTAINER:
        if (G.p.max_hearts < 20) G.p.max_hearts++;
        G.p.hp = (uint8_t)(G.p.max_hearts * 2); text = TXT_GET_CONTAINER; spr = SPR_HEARTC; break;
    default: break;
    }
    if (G.p.coins > 99999) G.p.coins = 99999;
    if (with_dialog && text >= 0) {
        G.hstate = H_HOLD;
        G.hold_sprite = spr;
        G.hdir = D_DOWN;
        show_text_id(text);
    }
    autosave();
}

static void buy(ent_t *e)
{
    int item = e->arg;
    int price = PRICES[item];
    if (G.p.coins < price) { show_text_id(TXT_SHOP_POOR); return; }
    switch (item) {
    case IT_BOMBS:
        if (G.p.has_bombs && G.p.bombs >= G.p.max_bombs) { show_text_id(TXT_SHOP_FULL); return; }
        G.p.bombs = (uint8_t)(G.p.bombs + 5 > G.p.max_bombs ? G.p.max_bombs : G.p.bombs + 5);
        if (!G.p.has_bombs) { G.p.has_bombs = 1; if (!G.p.has_bow) G.p.sel = 0; }
        show_text_id(TXT_SHOP_BOMBS);
        break;
    case IT_ARROWS:
        if (G.p.arrows >= G.p.max_arrows) { show_text_id(TXT_SHOP_FULL); return; }
        G.p.arrows = (uint8_t)(G.p.arrows + 10 > G.p.max_arrows ? G.p.max_arrows : G.p.arrows + 10);
        show_text_id(G.p.has_bow ? TXT_SHOP_ARROWS : TXT_NEED_BOW);
        break;
    case IT_REFILL:
        if (G.p.hp >= G.p.max_hearts * 2) { show_text_id(TXT_SHOP_FULL); return; }
        G.p.hp = (uint8_t)(G.p.max_hearts * 2);
        show_text_id(TXT_SHOP_REFILL);
        break;
    case IT_CONTAINER:
        if (flag_get(FLAG_SHOP_CONTAINER)) { show_text_id(TXT_SHOP_SOLD); return; }
        G.p.coins -= price;
        flag_set(FLAG_SHOP_CONTAINER);
        e->type = E_NONE;
        give_item(IT_CONTAINER, 1);
        return;
    }
    G.p.coins -= price;
    autosave();
}

/* ------------------------------------------------------- tile hits */
void hit_tile(int tx, int ty, int by_bomb)
{
    if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return;
    uint8_t t = G.tiles[ty * RW + tx];
    uint32_t p = tile_props[t];
    int can = (p & TP_CUT) || (by_bomb && (p & TP_BOMB));
    if (!can) return;
    const room_t *r = &rooms[G.room];
    /* a secret: the room has a mod at this spot keyed to a flag */
    for (int i = 0; i < r->nmods; i++) {
        const mod_t *m = &r->mods[i];
        if (m->x == tx && m->y == ty && m->tile != t && !flag_get(m->flag)) {
            ent_spawn(E_POOF, tx * 16, ty * 16);
            flag_set(m->flag);
            if (by_bomb) G.quake = 8;
            autosave();
            return;
        }
    }
    G.tiles[ty * RW + tx] = tile_under[t];
    ent_spawn(E_POOF, tx * 16, ty * 16);
    if ((p & TP_DROP) && rnd(100) < ((p & TP_TALL) ? 12 : 22)) drop_loot(tx * 16, ty * 16, 0);
}

/* --------------------------------------------------------- hero */
void hero_damage(int amount, int fromx, int fromy)
{
    if (G.hiframes > 0 || G.mode != MODE_PLAY) return;
    if (G.god) { G.hiframes = 30; return; }
    G.p.hp = (uint8_t)(G.p.hp > amount ? G.p.hp - amount : 0);
    G.hiframes = 60;
    int dx = hero_cx() - fromx, dy = hero_cy() - fromy;
    int adx = dx < 0 ? -dx : dx, ady = dy < 0 ? -dy : dy;
    G.hkbx = 0; G.hkby = 0;
    if (adx >= ady) G.hkbx = dx >= 0 ? 48 : -48;
    else G.hkby = dy >= 0 ? 48 : -48;
    G.hkbt = 10;
    G.hstate = H_HURT;
    if (G.p.hp == 0) {
        G.mode = MODE_GAMEOVER;
        G.over_sel = 0;
        G.p.deaths++;
    }
}

static void sword_box(int *x0, int *y0, int *x1, int *y1)
{
    int px = G.hx >> 4, py = G.hy >> 4;
    switch (G.hdir) {
    case D_DOWN: *x0 = px + 3; *y0 = py + 13; *x1 = px + 12; *y1 = py + 29; break;
    case D_UP: *x0 = px + 3; *y0 = py - 11; *x1 = px + 12; *y1 = py + 6; break;
    case D_RIGHT: *x0 = px + 11; *y0 = py + 5; *x1 = px + 28; *y1 = py + 14; break;
    default: *x0 = px - 12; *y0 = py + 5; *x1 = px + 4; *y1 = py + 14; break;
    }
}

static void sword_hits(void)
{
    int x0, y0, x1, y1;
    sword_box(&x0, &y0, &x1, &y1);
    for (int i = 0; i < MAX_ENTS; i++) {
        ent_t *e = &G.ents[i];
        if (!IS_ENEMY(e->type) || e->iframes) continue;
        if (ent_overlaps(e, x0, y0, x1, y1)) enemy_hurt(e, 1, hero_cx(), hero_cy(), 0);
    }
    if (G.htimer == 4) {
        /* cut tiles under the blade: tip and middle */
        int mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        int tipx = G.hdir == D_LEFT ? x0 + 2 : (G.hdir == D_RIGHT ? x1 - 2 : mx);
        int tipy = G.hdir == D_UP ? y0 + 2 : (G.hdir == D_DOWN ? y1 - 2 : my);
        hit_tile(mx >> 4, my >> 4, 0);
        if ((tipx >> 4) != (mx >> 4) || (tipy >> 4) != (my >> 4)) hit_tile(tipx >> 4, tipy >> 4, 0);
    }
}

static int count_type(int t)
{
    int n = 0;
    for (int i = 0; i < MAX_ENTS; i++)
        if (G.ents[i].type == t) n++;
    return n;
}

static void use_item(void)
{
    int cx = hero_cx(), cy = hero_cy() - 4;
    switch (G.p.sel) {
    case 0:
        if (!G.p.has_bombs || G.p.bombs == 0 || count_type(E_BOMB) >= 2) return;
        {
            ent_t *b = ent_spawn(E_BOMB, cx - 8 + DIR_DX[G.hdir] * 14, cy - 8 + DIR_DY[G.hdir] * 14 + (G.hdir == D_UP ? -2 : 0));
            if (b) G.p.bombs--;
        }
        break;
    case 1:
        if (!G.p.has_bow || G.p.arrows == 0 || count_type(E_ARROW) >= 1) return;
        {
            ent_t *a = ent_spawn(E_ARROW, cx - 8 + DIR_DX[G.hdir] * 8, cy - 8 + DIR_DY[G.hdir] * 8);
            if (a) { a->dir = (uint8_t)G.hdir; G.p.arrows--; }
        }
        G.hstate = H_ATTACK; G.htimer = 8; /* short bow pose, no sword */
        break;
    case 2:
        if (!G.p.has_boomerang || count_type(E_BOOMERANG) >= 1) return;
        {
            ent_t *b = ent_spawn(E_BOOMERANG, cx - 8 + DIR_DX[G.hdir] * 8, cy - 8 + DIR_DY[G.hdir] * 8);
            if (b) b->dir = (uint8_t)G.hdir;
        }
        break;
    }
}

static int talk_npc(ent_t *e)
{
    int id = e->arg;
    int t = TXT_SHOPKEEP;
    switch (id) {
    case NPC_ELDER:
        t = flag_get(FLAG_CRYSTAL2) && flag_get(FLAG_CRYSTAL1) ? TXT_ELDER_2 : (flag_get(FLAG_CRYSTAL1) ? TXT_ELDER_1 : TXT_ELDER_0);
        break;
    case NPC_SHOPKEEP: t = TXT_SHOPKEEP; break;
    case NPC_KID: t = TXT_KID; break;
    case NPC_FISHER: t = TXT_FISHER; break;
    case NPC_GARDENER: t = TXT_GARDENER; break;
    case NPC_GRANNY: t = TXT_GRANNY; break;
    case NPC_TAMSIN: t = TXT_TAMSIN; break;
    }
    int dx = hero_cx() - ((e->x >> 4) + 8), dy = hero_cy() - ((e->y >> 4) + 12);
    if ((dx < 0 ? -dx : dx) > (dy < 0 ? -dy : dy)) e->dir = dx < 0 ? D_LEFT : D_RIGHT;
    else e->dir = dy < 0 ? D_UP : D_DOWN;
    e->timer = 0; e->state = 0;
    show_text_id(t);
    return 1;
}

static int try_interact(void)
{
    int cx = hero_cx(), cy = hero_cy() - 2;
    int fx = cx, fy = cy;
    switch (G.hdir) {
    case D_UP: fy = hero_cy() - 15; break;
    case D_DOWN: fy = hero_cy() + 10; break;
    case D_LEFT: fx = cx - 13; break;
    default: fx = cx + 13; break;
    }
    /* entities in front */
    for (int i = 0; i < MAX_ENTS; i++) {
        ent_t *e = &G.ents[i];
        if (e->type != E_NPC && e->type != E_SHOPITEM) continue;
        int ex = e->x >> 4, ey = e->y >> 4;
        if (fx >= ex - 2 && fx <= ex + 17 && fy >= ey - 2 && fy <= ey + 17) {
            if (e->type == E_NPC) return talk_npc(e);
            if (G.hdir == D_UP) { buy(e); return 1; }
        }
    }
    int tx = fx >> 4, ty = fy >> 4;
    if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return 0;
    uint32_t p = tile_props_at_tile(tx, ty);
    const room_t *r = &rooms[G.room];
    if (p & TP_SIGN) {
        for (int i = 0; i < r->nsigns; i++)
            if (r->signs[i].x == tx && r->signs[i].y == ty) { show_text_id(r->signs[i].text); return 1; }
    }
    if (p & TP_CHEST) {
        for (int i = 0; i < r->nchests; i++) {
            const chest_t *c = &r->chests[i];
            if (c->x == tx && c->y == ty && !flag_get(c->flag)) {
                flag_set(c->flag);
                give_item(c->item, 1);
                return 1;
            }
        }
    }
    return 0;
}

static void try_open_door(int tx, int ty)
{
    uint32_t p = tile_props_at_tile(tx, ty);
    int d = rooms[G.room].dungeon;
    const room_t *r = &rooms[G.room];
    int want = 0;
    if (p & TP_LOCKED) {
        if (G.p.keys[d] > 0) want = 1;
        else if (!G.msg_cooldown) { show_text_id(TXT_LOCKED); G.msg_cooldown = 90; }
    } else if (p & TP_BOSSDOOR) {
        if (flag_get(d == 1 ? FLAG_BOSSKEY1 : FLAG_BOSSKEY2)) want = 2;
        else if (!G.msg_cooldown) { show_text_id(TXT_BOSSLOCKED); G.msg_cooldown = 90; }
    }
    if (!want) return;
    for (int i = 0; i < r->nmods; i++) {
        const mod_t *m = &r->mods[i];
        if (m->x == tx && m->y == ty) {
            if (want == 1) G.p.keys[d]--;
            flag_set(m->flag);
            ent_spawn(E_POOF, tx * 16, ty * 16);
            autosave();
            return;
        }
    }
}

static void hero_move_axis(int dx, int dy)
{
    int32_t step = dx ? dx : dy;
    int32_t s = step;
    while (s != 0) {
        int32_t nx = G.hx + (dx ? s : 0), ny = G.hy + (dy ? s : 0);
        if (!hero_blocked_at(nx, ny)) { G.hx = nx; G.hy = ny; return; }
        s += s > 0 ? -4 : 4;
        if ((step > 0 && s < 0) || (step < 0 && s > 0)) s = 0;
    }
    /* blocked: corner slide */
    for (int off = 1; off <= 7; off++) {
        for (int sgn = -1; sgn <= 1; sgn += 2) {
            int32_t ox = dy ? sgn * off * FP : 0, oy = dx ? sgn * off * FP : 0;
            if (!hero_blocked_at(G.hx + ox, G.hy + oy) &&
                !hero_blocked_at(G.hx + ox + (dx ? step : 0), G.hy + oy + (dy ? step : 0))) {
                int32_t sx = dy ? sgn * 16 : 0, sy = dx ? sgn * 16 : 0;
                if (!hero_blocked_at(G.hx + sx, G.hy + sy)) { G.hx += sx; G.hy += sy; }
                return;
            }
        }
    }
    /* still blocked: pushing into a door? */
    int fx = hero_cx() + DIR_DX[G.hdir] * 9, fy = hero_cy() - 3 + DIR_DY[G.hdir] * 9;
    if (G.hdir == D_UP) fy = hero_cy() - 14;
    G.push_t++;
    if (G.push_t > 8) try_open_door(fx >> 4, fy >> 4);
}

static void update_hero(void)
{
    if (G.hiframes > 0) G.hiframes--;
    if (G.msg_cooldown > 0) G.msg_cooldown--;

    if (G.hstate == H_HURT) {
        int32_t nx = G.hx + G.hkbx, ny = G.hy + G.hkby;
        if (!hero_blocked_at(nx, G.hy)) G.hx = nx;
        if (!hero_blocked_at(G.hx, ny)) G.hy = ny;
        if (--G.hkbt <= 0) G.hstate = H_NORMAL;
        return;
    }
    if (G.hstate == H_ATTACK) {
        G.htimer++;
        if (G.htimer >= 2 && G.htimer <= 10 && G.p.sel >= 0 && G.htimer < 100) sword_hits();
        if (G.htimer >= 14) G.hstate = H_NORMAL;
        return;
    }
    if (G.hstate == H_HOLD) return;

    if (G.pressed & EV_BTN_START) { G.mode = MODE_MENU; G.menu_sel = G.p.sel; return; }
    if (G.pressed & EV_BTN_X) {
        if (!try_interact()) { G.hstate = H_ATTACK; G.htimer = 0; }
        return;
    }
    if (G.pressed & EV_BTN_O) { use_item(); if (G.hstate == H_ATTACK) { G.htimer = 100; G.hstate = H_NORMAL; } }

    int dx = 0, dy = 0;
    if (G.buttons & EV_BTN_LEFT) dx = -1;
    if (G.buttons & EV_BTN_RIGHT) dx = 1;
    if (G.buttons & EV_BTN_UP) dy = -1;
    if (G.buttons & EV_BTN_DOWN) dy = 1;
    if (dx || dy) {
        /* keep facing if still pressing that way, else pick new */
        int keep = (G.hdir == D_LEFT && dx < 0) || (G.hdir == D_RIGHT && dx > 0) ||
                   (G.hdir == D_UP && dy < 0) || (G.hdir == D_DOWN && dy > 0);
        if (!keep) G.hdir = dx < 0 ? D_LEFT : dx > 0 ? D_RIGHT : dy < 0 ? D_UP : D_DOWN;
        int speed = 24;
        if (dx && dy) speed = 17;
        if (dx) hero_move_axis(dx * speed, 0);
        if (dy) hero_move_axis(0, dy * speed);
        G.hanim++;
        G.hwalk = 1;
    } else {
        G.hwalk = 0;
        G.push_t = 0;
    }
    if (!dx && !dy) G.push_t = 0;
}

static void check_hero_tiles(void)
{
    int cx = hero_cx(), cy = hero_cy();
    uint32_t p = props_at(cx, cy);
    /* warp */
    if (p & TP_WARP) {
        const room_t *r = &rooms[G.room];
        int tx = cx >> 4, ty = cy >> 4;
        for (int i = 0; i < r->nwarps; i++) {
            const warp_t *w = &r->warps[i];
            if (w->x == tx && w->y == ty) {
                G.warp_room = w->room; G.warp_x = w->px; G.warp_y = w->py; G.warp_dir = w->dir;
                G.mode = MODE_FADEOUT; G.fade = 0;
                return;
            }
        }
    }
    if ((p & TP_PIT) && G.hstate != H_HURT) {
        G.mode = MODE_FALL; G.fall_t = 0;
        return;
    }
    /* spikes under the feet box */
    int x0, y0, x1, y1;
    hero_box_at(G.hx, G.hy, &x0, &y0, &x1, &y1);
    for (int ty = (y0 + 2) >> 4; ty <= ((y1 - 1) >> 4); ty++)
        for (int tx = (x0 + 2) >> 4; tx <= ((x1 - 2) >> 4); tx++)
            if (tile_props_at_tile(tx, ty) & TP_SPIKE) hero_damage(1, tx * 16 + 8, ty * 16 + 8);
    if (p & TP_POOL) {
        if ((G.frame & 7) == 0 && G.p.hp < G.p.max_hearts * 2) {
            G.p.hp++;
            ent_spawn(E_SPARKLE, cx - 8 + rnd(16) - 8, cy - 16 - rnd(8));
        }
        if (!G.pool_msg) { G.pool_msg = 1; show_text_id(TXT_FAIRY); }
    }
}

static void update_play(void)
{
    G.p.play_frames++;
    update_hero();
    if (G.mode != MODE_PLAY) return;
    ents_update();
    if (G.mode != MODE_PLAY) return;

    /* shutters */
    int alive = enemies_alive();
    if (alive > 0 && G.has_shutters && !G.shut_closed && !hero_on_shutter()) G.shut_closed = 1;
    if (alive == 0 && G.shut_closed) G.shut_closed = 0;

    check_hero_tiles();
    if (G.mode != MODE_PLAY) return;

    /* room edges */
    int x0, y0, x1, y1;
    hero_box_at(G.hx, G.hy, &x0, &y0, &x1, &y1);
    if (x0 < 0) start_scroll(-1, 0);
    else if (x1 > RW * 16 - 1) start_scroll(1, 0);
    else if (y0 < 0) start_scroll(0, -1);
    else if (y1 > RH * 16 - 1) start_scroll(0, 1);
    if (G.quake > 0) G.quake--;
}

static void respawn(void)
{
    load_room(G.p.save_room);
    G.hx = G.p.save_x * FP; G.hy = G.p.save_y * FP; G.hdir = G.p.save_dir;
    G.hstate = H_NORMAL; G.hiframes = 60;
    room_entered();
    G.mode = MODE_FADEIN; G.fade = 8;
}

static void start_game(int fresh)
{
    if (fresh) progress_new();
    G.p.hp = G.p.hp ? G.p.hp : (uint8_t)(G.p.max_hearts * 2);
    if (G.p.hp < 6 && G.p.hp < G.p.max_hearts * 2) G.p.hp = 6;
    respawn();
    G.hiframes = 0;
    if (fresh) autosave();
}

static void update_title(void)
{
    int n = G.has_save ? 3 : 2;
    if (G.pressed & EV_BTN_UP) G.title_sel = (G.title_sel + n - 1) % n;
    if (G.pressed & EV_BTN_DOWN) G.title_sel = (G.title_sel + 1) % n;
    if (G.pressed & (EV_BTN_X | EV_BTN_START)) {
        int opt = G.has_save ? G.title_sel : G.title_sel + 1; /* 0 continue,1 new,2 exit */
        if (opt == 0) start_game(0);
        else if (opt == 1) start_game(1);
        else G.exit_requested = 1;
    }
}

static int item_owned(int i)
{
    return i == 0 ? G.p.has_bombs : i == 1 ? G.p.has_bow : G.p.has_boomerang;
}

static void update_menu(void)
{
    if (G.pressed & (EV_BTN_START | EV_BTN_O)) { G.mode = MODE_PLAY; return; }
    if (G.menu_sel < 3) {
        if (G.pressed & EV_BTN_LEFT) G.menu_sel = (G.menu_sel + 2) % 3;
        if (G.pressed & EV_BTN_RIGHT) G.menu_sel = (G.menu_sel + 1) % 3;
        if (G.pressed & EV_BTN_DOWN) G.menu_sel = 3;
    } else {
        if (G.pressed & EV_BTN_UP) G.menu_sel = G.p.sel;
        if (G.pressed & (EV_BTN_LEFT | EV_BTN_RIGHT)) G.menu_sel = G.menu_sel == 3 ? 4 : 3;
    }
    if (G.pressed & EV_BTN_X) {
        if (G.menu_sel < 3) {
            if (item_owned(G.menu_sel)) G.p.sel = (uint8_t)G.menu_sel;
        } else if (G.menu_sel == 3) {
            autosave();
            G.mode = MODE_PLAY;
        } else {
            autosave();
            G.exit_requested = 1;
        }
    }
}

static void update_gameover(void)
{
    if (G.pressed & (EV_BTN_UP | EV_BTN_DOWN)) G.over_sel ^= 1;
    if (G.pressed & (EV_BTN_X | EV_BTN_START)) {
        G.p.hp = (uint8_t)(G.p.max_hearts * 2 < 6 ? G.p.max_hearts * 2 : 6);
        if (G.over_sel == 0) respawn();
        else { save_all(); G.exit_requested = 1; }
    }
}

/* -------------------------------------------------------------- API */
static void reset_state(void)
{
    ev_platform_t keep = G.plat;
    memset(&G, 0, sizeof G);
    G.plat = keep;
}

void ev_init(const ev_platform_t *platform)
{
    memset(&G, 0, sizeof G);
    if (platform) G.plat = *platform;
    reset_state();
    progress_new();
    G.has_save = load_all();
    G.mode = MODE_TITLE;
    G.title_sel = 0;
    load_room(START_ROOM);
    G.hx = START_X * FP; G.hy = START_Y * FP;
    G.pal_fade = -1;
}

ev_status_t ev_update(uint8_t buttons)
{
    G.pressed = buttons & (uint8_t)~G.buttons;
    G.buttons = buttons;
    G.frame++;
    switch (G.mode) {
    case MODE_TITLE: update_title(); break;
    case MODE_PLAY: update_play(); break;
    case MODE_SCROLL: update_scroll(); break;
    case MODE_FADEOUT:
        if (++G.fade >= 8) { do_warp(); G.mode = MODE_FADEIN; }
        break;
    case MODE_FADEIN:
        if (--G.fade <= 0) { G.fade = 0; G.mode = MODE_PLAY; }
        break;
    case MODE_DIALOG: update_dialog(); break;
    case MODE_MENU: update_menu(); break;
    case MODE_GAMEOVER: update_gameover(); break;
    case MODE_FALL:
        if (++G.fall_t >= 30) {
            G.hx = G.entry_x; G.hy = G.entry_y; G.hdir = G.entry_dir;
            G.mode = MODE_PLAY;
            G.hiframes = 0;
            hero_damage(2, hero_cx(), hero_cy() - 20);
            if (G.mode == MODE_PLAY) G.hstate = H_NORMAL;
            G.hiframes = 60;
        }
        break;
    case MODE_ENDING:
        if (G.pressed & (EV_BTN_X | EV_BTN_START)) G.mode = MODE_PLAY;
        break;
    }
    sort_draw_order();
    if (G.exit_requested) return EV_EXIT;
    return EV_RUNNING;
}

void ev_render(uint16_t *dst, int y0, int rows)
{
    render_band(dst, y0, rows);
}

void ev_save(void) { save_all(); }
int32_t ev_coins(void) { return G.p.coins; }
