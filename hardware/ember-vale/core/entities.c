/* Ember Vale - enemies, bosses, pickups, projectiles and effects. */
#include "ev_internal.h"

static int iabs(int v) { return v < 0 ? -v : v; }
static int isign(int v) { return v < 0 ? -1 : v > 0; }

/* -------------------------------------------------------------- spawn */
static void ent_defaults(ent_t *e)
{
    e->w = 16; e->h = 16;
    switch (e->type) {
    case SP_BLOB: e->hp = 2; break;
    case SP_BLOB_RED: e->hp = 3; break;
    case SP_BAT: e->hp = 1; break;
    case SP_BEETLE: e->hp = 2; break;
    case SP_CRAB: e->hp = 2; break;
    case SP_GHOST: e->hp = 2; break;
    case SP_SHROOM: e->hp = 2; break;
    case SP_SKELETON: e->hp = 3; break;
    case SP_KNIGHT: e->hp = 4; break;
    case SP_KNIGHT2: e->hp = 5; break;
    case SP_THORNBACK: e->hp = 8; e->w = 32; e->h = 32; break;
    case SP_WISP: e->hp = 12; e->w = 32; e->h = 32; break;
    case E_EXPLOSION: e->w = 32; e->h = 32; break;
    default: e->hp = 1; break;
    }
}

ent_t *ent_spawn(int type, int px, int py)
{
    for (int i = 0; i < MAX_ENTS; i++) {
        ent_t *e = &G.ents[i];
        if (e->type != E_NONE) continue;
        memset(e, 0, sizeof *e);
        e->type = (uint8_t)type;
        e->x = px * FP; e->y = py * FP;
        e->hx = (int16_t)px; e->hy = (int16_t)py;
        e->flag = 0xffff;
        ent_defaults(e);
        e->timer2 = (uint16_t)rnd(60);
        e->dir = (uint8_t)rnd(4);
        return e;
    }
    return 0;
}

void ents_clear(void)
{
    memset(G.ents, 0, sizeof G.ents);
    G.norder = 0;
}

void ents_spawn_room(void)
{
    const room_t *r = &rooms[G.room];
    for (int i = 0; i < r->nspawns; i++) {
        const spawn_t *s = &r->spawns[i];
        if (s->flag != 0xffff && flag_get(s->flag)) continue;
        ent_t *e = ent_spawn(s->type, s->x * 16 + (s->type == SP_THORNBACK || s->type == SP_WISP ? -8 : 0), s->y * 16);
        if (!e) continue;
        e->arg = s->arg;
        e->flag = s->flag;
        if (e->type == E_NPC) e->dir = D_DOWN;
        if (e->type == E_COIN) { e->type = s->arg >= 20 ? E_PICK_RED : s->arg >= 5 ? E_PICK_SILVER : E_PICK_GOLD; e->arg = 1; }
        if (IS_BOSS(e->type)) e->timer = 60;
    }
}

/* ------------------------------------------------------------- boxes */
void ent_box(const ent_t *e, int *x0, int *y0, int *x1, int *y1)
{
    int px = e->x >> 4, py = e->y >> 4;
    if (e->w >= 32) { *x0 = px + 4; *y0 = py + 6; *x1 = px + 27; *y1 = py + 29; return; }
    switch (e->type) {
    case E_BOMB: *x0 = px + 4; *y0 = py + 5; *x1 = px + 11; *y1 = py + 14; return;
    case E_ARROW:
        if (e->dir < 2) { *x0 = px + 6; *y0 = py + 2; *x1 = px + 9; *y1 = py + 13; }
        else { *x0 = px + 2; *y0 = py + 6; *x1 = px + 13; *y1 = py + 9; }
        return;
    case E_SPORE: case E_FIREBALL: case E_BOOMERANG:
        *x0 = px + 4; *y0 = py + 4; *x1 = px + 11; *y1 = py + 11; return;
    default:
        *x0 = px + 2; *y0 = py + 4; *x1 = px + 13; *y1 = py + 15; return;
    }
}

int ent_overlaps(const ent_t *e, int x0, int y0, int x1, int y1)
{
    int a0, b0, a1, b1;
    ent_box(e, &a0, &b0, &a1, &b1);
    return a1 >= x0 && a0 <= x1 && b1 >= y0 && b0 <= y1;
}

static int ent_cx(const ent_t *e) { return (e->x >> 4) + e->w / 2; }
static int ent_cy(const ent_t *e) { return (e->y >> 4) + e->h / 2 + 2; }

static int hero_touch(const ent_t *e, int shrink)
{
    int x0 = (G.hx >> 4) + 3 + shrink, y0 = (G.hy >> 4) + 4 + shrink;
    int x1 = (G.hx >> 4) + 12 - shrink, y1 = (G.hy >> 4) + 15 - shrink;
    return ent_overlaps(e, x0, y0, x1, y1);
}

/* move with collision, returns 1 if blocked */
static int ent_move(ent_t *e, int32_t dx, int32_t dy, int mode)
{
    int blocked = 0;
    int x0, y0, x1, y1;
    if (dx) {
        ent_t t = *e; t.x += dx;
        ent_box(&t, &x0, &y0, &x1, &y1);
        if (!box_blocked(x0, y0, x1, y1, mode)) e->x = t.x; else blocked = 1;
    }
    if (dy) {
        ent_t t = *e; t.y += dy;
        ent_box(&t, &x0, &y0, &x1, &y1);
        if (!box_blocked(x0, y0, x1, y1, mode)) e->y = t.y; else blocked = 1;
    }
    return blocked;
}

static int dir_to_hero(const ent_t *e)
{
    int dx = hero_cx() - ent_cx(e), dy = hero_cy() - ent_cy(e);
    if (iabs(dx) > iabs(dy)) return dx < 0 ? D_LEFT : D_RIGHT;
    return dy < 0 ? D_UP : D_DOWN;
}

static void aim(ent_t *p, const ent_t *from, int speed, int angle_off)
{
    int dx = hero_cx() - ent_cx(from), dy = hero_cy() - 4 - ent_cy(from);
    /* cheap normalisation */
    int ad = iabs(dx) > iabs(dy) ? iabs(dx) + iabs(dy) / 2 : iabs(dy) + iabs(dx) / 2;
    if (ad == 0) ad = 1;
    int vx = dx * speed / ad, vy = dy * speed / ad;
    if (angle_off) { /* rotate by about angle_off * 15 degrees */
        int c = 256 - iabs(angle_off) * 9, s = angle_off * 66;
        int nx = (vx * c - vy * s) / 256, ny = (vx * s + vy * c) / 256;
        vx = nx; vy = ny;
    }
    p->vx = vx; p->vy = vy;
}

/* -------------------------------------------------------------- damage */
void drop_loot(int px, int py, int boss)
{
    int r = rnd(100);
    int t = E_NONE;
    if (boss) t = E_PICK_RED;
    else if (r < 30) t = E_NONE;
    else if (r < 55) t = E_PICK_GOLD;
    else if (r < 65) t = E_PICK_SILVER;
    else if (r < 68) t = E_PICK_RED;
    else if (r < 82) t = E_PICK_HEART;
    else if (r < 90) t = G.p.has_bombs ? E_PICK_BOMBS : E_PICK_GOLD;
    else if (r < 97) t = G.p.has_bow ? E_PICK_ARROWS : E_PICK_HEART;
    if (t == E_NONE) return;
    ent_t *e = ent_spawn(t, px, py);
    if (e) e->timer = 0;
}

static void boss_defeated(ent_t *e)
{
    const room_t *r = &rooms[G.room];
    int d = r->dungeon;
    int cx = ent_cx(e) - 8, cy = ent_cy(e) - 8;
    for (int i = 0; i < 6; i++) ent_spawn(E_POOF, cx - 12 + rnd(24), cy - 12 + rnd(24));
    if (e->flag != 0xffff) flag_set(e->flag);
    G.quake = 20;
    int hf = d == 1 ? FLAG_BOSSHEART1 : FLAG_BOSSHEART2;
    if (!flag_get(hf)) {
        ent_t *h = ent_spawn(E_HEARTC, 9 * 16 - 16, 7 * 16);
        if (h) { h->flag = (uint16_t)hf; }
    }
    int cf = d == 1 ? FLAG_CRYSTAL1 : FLAG_CRYSTAL2;
    if (!flag_get(cf)) {
        ent_t *c = ent_spawn(E_PICK_CRYSTAL, 10 * 16, 7 * 16);
        if (c) { c->arg = (uint8_t)d; c->flag = (uint16_t)cf; }
    }
    drop_loot(cx, cy, 1);
    autosave();
}

void enemy_hurt(ent_t *e, int dmg, int fromx, int fromy, int stun_only)
{
    if (!IS_ENEMY(e->type) || e->iframes) return;
    if (stun_only) {
        if (IS_BOSS(e->type)) return;
        if (e->type == SP_BAT || e->type == SP_GHOST) { dmg = 1; }
        else { e->stun = 120; e->iframes = 8; return; }
    }
    if (e->type == SP_THORNBACK && e->state != 3 && dmg < 2) {
        /* armoured unless stunned: clank */
        e->iframes = 12;
        ent_spawn(E_SPARKLE, ent_cx(e) - 8, ent_cy(e) - 12);
        return;
    }
    e->hp -= (int16_t)dmg;
    e->iframes = IS_BOSS(e->type) ? 30 : 20;
    if (!IS_BOSS(e->type)) {
        int dx = ent_cx(e) - fromx, dy = ent_cy(e) - fromy;
        if (iabs(dx) >= iabs(dy)) { e->kbx = (int16_t)(isign(dx) * 48); e->kby = 0; }
        else { e->kby = (int16_t)(isign(dy) * 48); e->kbx = 0; }
        e->kbt = 8;
    }
    if (e->hp <= 0) {
        int px = e->x >> 4, py = e->y >> 4;
        if (IS_BOSS(e->type)) {
            boss_defeated(e);
        } else {
            ent_spawn(E_POOF, px, py);
            drop_loot(px, py, 0);
        }
        e->type = E_NONE;
    }
}

/* ------------------------------------------------------------ enemies */
static int contact_damage(const ent_t *e)
{
    switch (e->type) {
    case SP_KNIGHT: case SP_KNIGHT2: case SP_THORNBACK: case SP_WISP: return 2;
    default: return 1;
    }
}

static void walker_turn(ent_t *e)
{
    int nd = rnd(4);
    if (nd == e->dir) nd = (nd + 1 + rnd(3)) & 3;
    e->dir = (uint8_t)nd;
    e->timer = (uint16_t)(40 + rnd(80));
}

static void update_thornback(ent_t *e)
{
    /* state 0 wander, 1 wind-up, 2 charge, 3 stunned */
    switch (e->state) {
    case 0:
        if (e->timer == 0) { e->state = 1; e->timer = 36; e->dir = (uint8_t)dir_to_hero(e); break; }
        e->timer--;
        if ((G.frame & 31) == 0) e->dir = (uint8_t)(rnd(2) ? dir_to_hero(e) : rnd(4));
        if (ent_move(e, DIR_DX[e->dir] * 12, DIR_DY[e->dir] * 12, 1)) e->dir ^= 1;
        break;
    case 1:
        if (--e->timer == 0) { e->state = 2; e->dir = (uint8_t)dir_to_hero(e); }
        break;
    case 2:
        if (ent_move(e, DIR_DX[e->dir] * 56, DIR_DY[e->dir] * 56, 1)) {
            e->state = 3; e->timer = 120; G.quake = 10;
        }
        break;
    case 3:
        if (--e->timer == 0) { e->state = 0; e->timer = 80 + rnd(60); }
        break;
    }
}

static void update_wisp(ent_t *e)
{
    /* drifts in a loop over the arena, fires fan of embers, swoops */
    e->timer2++;
    if (e->state == 0) {
        int t = e->timer2;
        /* lissajous around the arena centre */
        static const int8_t sinlut[16] = {0, 38, 71, 92, 100, 92, 71, 38, 0, -38, -71, -92, -100, -92, -71, -38};
        int sx = sinlut[(t / 8) & 15], sy = sinlut[((t / 5) + 4) & 15];
        int tx = (144 + sx * 96 / 100) * FP, ty = (72 + sy * 40 / 100) * FP;
        e->x += (tx - e->x) / 16;
        e->y += (ty - e->y) / 16;
        if (e->timer > 0) e->timer--;
        else {
            int n = e->hp <= 6 ? 5 : 3;
            for (int i = 0; i < n; i++) {
                ent_t *f = ent_spawn(E_FIREBALL, ent_cx(e) - 8, ent_cy(e) - 8);
                if (f) aim(f, e, 24, i - n / 2);
            }
            e->timer = (uint16_t)(e->hp <= 6 ? 70 : 100);
            if (rnd(3) == 0) { e->state = 1; e->timer = 30; }
        }
    } else if (e->state == 1) { /* wind-up then swoop */
        if (--e->timer == 0) { e->state = 2; e->timer = 40; aim(e, e, 40, 0); }
    } else {
        e->x += e->vx; e->y += e->vy;
        if (e->x < 0) e->x = 0;
        if (e->y < 0) e->y = 0;
        if (e->x > (RW * 16 - 32) * FP) e->x = (RW * 16 - 32) * FP;
        if (e->y > (RH * 16 - 32) * FP) e->y = (RH * 16 - 32) * FP;
        if (--e->timer == 0) { e->state = 0; e->timer = 60; }
    }
}

static void update_enemy(ent_t *e)
{
    if (e->iframes) e->iframes--;
    e->anim++;
    int fly = (e->type == SP_BAT || e->type == SP_GHOST || e->type == SP_WISP) ? 2 : 1;
    if (e->kbt) {
        e->kbt--;
        ent_move(e, e->kbx, e->kby, fly);
        goto touch;
    }
    if (e->stun) { e->stun--; goto touch; }

    switch (e->type) {
    case SP_BLOB: case SP_BLOB_RED:
        if (e->state == 0) {
            if (e->timer2 > 0) e->timer2--;
            else {
                e->state = 1; e->timer = 18;
                e->dir = (uint8_t)(rnd(2) ? dir_to_hero(e) : rnd(4));
            }
        } else {
            int sp = e->type == SP_BLOB_RED ? 22 : 16;
            ent_move(e, DIR_DX[e->dir] * sp, DIR_DY[e->dir] * sp, 1);
            if (--e->timer == 0) { e->state = 0; e->timer2 = (uint16_t)(30 + rnd(50)); }
        }
        break;
    case SP_BAT:
        if (e->timer == 0) {
            e->timer = (uint16_t)(20 + rnd(40));
            e->vx = (rnd(5) - 2) * 10; e->vy = (rnd(5) - 2) * 10;
            if (rnd(3) == 0) aim(e, e, 22, 0);
        }
        e->timer--;
        if (ent_move(e, e->vx, e->vy, 2)) { e->vx = -e->vx; e->vy = -e->vy; }
        break;
    case SP_BEETLE: case SP_SKELETON:
        if (e->timer == 0) walker_turn(e);
        e->timer--;
        if (e->type == SP_SKELETON && (G.frame & 63) == 0 && rnd(2)) e->dir = (uint8_t)dir_to_hero(e);
        if (ent_move(e, DIR_DX[e->dir] * (e->type == SP_SKELETON ? 14 : 12), DIR_DY[e->dir] * (e->type == SP_SKELETON ? 14 : 12), 1)) walker_turn(e);
        break;
    case SP_CRAB:
        if (e->dir < 2) e->dir = D_LEFT;
        if (ent_move(e, (e->dir == D_LEFT ? -20 : 20), 0, 1) || rnd(120) == 0) e->dir = e->dir == D_LEFT ? D_RIGHT : D_LEFT;
        break;
    case SP_GHOST: {
        int dx = hero_cx() - ent_cx(e), dy = hero_cy() - ent_cy(e);
        if ((G.frame & 1) == 0) ent_move(e, isign(dx) * 12, isign(dy) * 12, 2);
        e->dir = dx < 0 ? D_LEFT : D_RIGHT;
        break;
    }
    case SP_SHROOM:
        if (e->timer == 0) {
            e->timer = (uint16_t)(110 + rnd(60));
            ent_t *s = ent_spawn(E_SPORE, ent_cx(e) - 8, ent_cy(e) - 10);
            if (s) aim(s, e, 22, 0);
        }
        e->timer--;
        if ((G.frame & 3) == 0) {
            if (e->timer2 == 0) { e->dir = (uint8_t)rnd(4); e->timer2 = (uint16_t)(30 + rnd(40)); }
            e->timer2--;
            ent_move(e, DIR_DX[e->dir] * 16, DIR_DY[e->dir] * 16, 1);
        }
        break;
    case SP_KNIGHT: case SP_KNIGHT2: {
        int sp = e->type == SP_KNIGHT2 ? 18 : 14;
        int dx = hero_cx() - ent_cx(e), dy = hero_cy() - ent_cy(e);
        if (iabs(dx) + iabs(dy) < 120) {
            if ((G.frame & 15) == 0) e->dir = (uint8_t)dir_to_hero(e);
            if (ent_move(e, DIR_DX[e->dir] * sp, DIR_DY[e->dir] * sp, 1)) e->dir = (uint8_t)((e->dir + 2 + rnd(2)) & 3);
        } else {
            if (e->timer == 0) walker_turn(e);
            e->timer--;
            if (ent_move(e, DIR_DX[e->dir] * 10, DIR_DY[e->dir] * 10, 1)) walker_turn(e);
        }
        break;
    }
    case SP_THORNBACK: update_thornback(e); break;
    case SP_WISP: update_wisp(e); break;
    }
touch:
    if (e->type != E_NONE && !e->stun && hero_touch(e, 1))
        hero_damage(contact_damage(e), ent_cx(e), ent_cy(e));
}

/* ------------------------------------------------------------- others */
static void collect(ent_t *e)
{
    switch (e->type) {
    case E_PICK_HEART: G.p.hp = (uint8_t)(G.p.hp + 2 > G.p.max_hearts * 2 ? G.p.max_hearts * 2 : G.p.hp + 2); break;
    case E_PICK_GOLD: G.p.coins += 1; G.p.lifetime_coins += 1; break;
    case E_PICK_SILVER: G.p.coins += 5; G.p.lifetime_coins += 5; break;
    case E_PICK_RED: G.p.coins += 20; G.p.lifetime_coins += 20; break;
    case E_PICK_BOMBS: G.p.bombs = (uint8_t)(G.p.bombs + 4 > G.p.max_bombs ? G.p.max_bombs : G.p.bombs + 4); break;
    case E_PICK_ARROWS: G.p.arrows = (uint8_t)(G.p.arrows + 5 > G.p.max_arrows ? G.p.max_arrows : G.p.arrows + 5); break;
    case E_HEARTC:
        if (e->flag != 0xffff) flag_set(e->flag);
        e->type = E_NONE;
        give_item(IT_CONTAINER, 1);
        return;
    case E_PICK_CRYSTAL:
        if (e->flag != 0xffff) flag_set(e->flag);
        e->type = E_NONE;
        G.hstate = H_HOLD; G.hdir = D_DOWN;
        G.hold_sprite = e->arg == 1 ? SPR_SUN : SPR_MOON;
        if (flag_get(FLAG_CRYSTAL1) && flag_get(FLAG_CRYSTAL2) && !G.p.complete) G.p.complete = 1;
        autosave();
        show_text_id(e->arg == 1 ? TXT_GET_SUN : TXT_GET_MOON);
        return;
    }
    if (G.p.coins > 99999) G.p.coins = 99999;
    e->type = E_NONE;
}

static void explode(ent_t *e)
{
    int cx = ent_cx(e), cy = ent_cy(e) - 2;
    for (int i = 0; i < MAX_ENTS; i++) {
        ent_t *o = &G.ents[i];
        if (!IS_ENEMY(o->type)) continue;
        if (iabs(ent_cx(o) - cx) < 24 + o->w / 4 && iabs(ent_cy(o) - cy) < 24 + o->h / 4) {
            o->iframes = 0;
            enemy_hurt(o, 2, cx, cy, 0);
        }
    }
    if (iabs(hero_cx() - cx) < 18 && iabs(hero_cy() - 4 - cy) < 18) hero_damage(2, cx, cy);
    for (int ty = (cy - 20) >> 4; ty <= (cy + 20) >> 4; ty++)
        for (int tx = (cx - 20) >> 4; tx <= (cx + 20) >> 4; tx++) {
            int ddx = tx * 16 + 8 - cx, ddy = ty * 16 + 8 - cy;
            if (ddx * ddx + ddy * ddy <= 26 * 26) hit_tile(tx, ty, 1);
        }
    G.quake = 8;
}

static int offroom(const ent_t *e)
{
    int px = e->x >> 4, py = e->y >> 4;
    return px < -16 || py < -16 || px > RW * 16 || py > RH * 16;
}

static void update_arrow(ent_t *e)
{
    int dx = DIR_DX[e->dir] * 64, dy = DIR_DY[e->dir] * 64;
    e->x += dx; e->y += dy;
    if (offroom(e)) { e->type = E_NONE; return; }
    int tipx = ent_cx(e) + DIR_DX[e->dir] * 6, tipy = (e->y >> 4) + 8 + DIR_DY[e->dir] * 6;
    for (int i = 0; i < MAX_ENTS; i++) {
        ent_t *o = &G.ents[i];
        if (!IS_ENEMY(o->type) || o->iframes) continue;
        if (ent_overlaps(o, tipx - 2, tipy - 2, tipx + 2, tipy + 2)) {
            int dmg = o->type == SP_WISP ? 2 : (o->type == SP_THORNBACK ? 1 : 2);
            enemy_hurt(o, dmg, ent_cx(e), ent_cy(e), 0);
            e->type = E_NONE;
            return;
        }
    }
    uint32_t p = props_at(tipx, tipy);
    if (p & TP_EYE) {
        const room_t *r = &rooms[G.room];
        if (r->eye_flag != 0xffff && !flag_get(r->eye_flag)) {
            flag_set(r->eye_flag);
            ent_spawn(E_SPARKLE, (tipx & ~15), (tipy & ~15));
            G.quake = 6;
            autosave();
        }
        e->type = E_NONE;
        return;
    }
    if ((p & TP_SOLID) && !(p & TP_WATER)) { ent_spawn(E_POOF, e->x >> 4, e->y >> 4); e->type = E_NONE; }
}

static void update_boomerang(ent_t *e)
{
    e->anim++;
    if (e->state == 0) {
        e->x += DIR_DX[e->dir] * 56; e->y += DIR_DY[e->dir] * 56;
        e->timer++;
        int x0, y0, x1, y1;
        ent_box(e, &x0, &y0, &x1, &y1);
        if (e->timer >= 24 || box_blocked(x0, y0, x1, y1, 1)) e->state = 1;
    } else {
        int tx = (hero_cx() - 8) * FP, ty = (hero_cy() - 12) * FP;
        int dx = tx - e->x, dy = ty - e->y;
        int ad = iabs(dx) > iabs(dy) ? iabs(dx) : iabs(dy);
        if (ad <= 64) { e->type = E_NONE; return; }
        e->x += dx * 60 / ad; e->y += dy * 60 / ad;
    }
    for (int i = 0; i < MAX_ENTS; i++) {
        ent_t *o = &G.ents[i];
        if (o == e || o->type == E_NONE) continue;
        int x0, y0, x1, y1;
        ent_box(e, &x0, &y0, &x1, &y1);
        if (!ent_overlaps(o, x0, y0, x1, y1)) continue;
        if (IS_ENEMY(o->type)) { enemy_hurt(o, 1, ent_cx(e), ent_cy(e), 1); e->state = 1; }
        else if (IS_PICKUP(o->type) && o->type != E_HEARTC && o->type != E_PICK_CRYSTAL) collect(o);
    }
}

static void update_other(ent_t *e)
{
    e->anim++;
    switch (e->type) {
    case E_NPC: {
        if (e->arg == NPC_SHOPKEEP || G.mode != MODE_PLAY) break;
        if (e->timer == 0) {
            e->state = (uint8_t)(rnd(3) == 0);
            e->timer = (uint16_t)(40 + rnd(80));
            if (e->state) {
                e->dir = (uint8_t)rnd(4);
                int px = e->x >> 4, py = e->y >> 4;
                if (px > e->hx + 24) e->dir = D_LEFT;
                if (px < e->hx - 24) e->dir = D_RIGHT;
                if (py > e->hy + 16) e->dir = D_UP;
                if (py < e->hy - 16) e->dir = D_DOWN;
            }
        }
        e->timer--;
        if (e->state && (G.frame & 1)) {
            ent_t t = *e;
            t.x += DIR_DX[e->dir] * 16; t.y += DIR_DY[e->dir] * 16;
            int x0, y0, x1, y1;
            ent_box(&t, &x0, &y0, &x1, &y1);
            int hx0 = (G.hx >> 4) + 2, hy0 = (G.hy >> 4) + 6;
            int hit_hero = x1 >= hx0 && x0 <= hx0 + 11 && y1 >= hy0 && y0 <= hy0 + 9;
            if (!box_blocked(x0, y0, x1, y1, 1) && !hit_hero) { e->x = t.x; e->y = t.y; }
            else e->state = 0;
        }
        break;
    }
    case E_FAIRY:
        e->x = e->hx * FP + ((e->anim * 3) % 64 < 32 ? (e->anim * 3) % 32 : 32 - (e->anim * 3) % 32) * FP / 2 - 8 * FP;
        e->y = e->hy * FP + ((e->anim / 6) % 8 < 4 ? 0 : -2 * FP);
        if (hero_touch(e, 0)) {
            G.p.hp = (uint8_t)(G.p.max_hearts * 2);
            for (int i = 0; i < 4; i++) ent_spawn(E_SPARKLE, (e->x >> 4) - 8 + rnd(16), (e->y >> 4) - 8 + rnd(16));
            e->type = E_NONE;
        }
        break;
    case E_PICK_HEART: case E_PICK_GOLD: case E_PICK_SILVER: case E_PICK_RED:
    case E_PICK_BOMBS: case E_PICK_ARROWS: case E_HEARTC: case E_PICK_CRYSTAL:
        if (e->timer < 0xffff) e->timer++;
        if (e->arg == 0 && e->type != E_HEARTC && e->type != E_PICK_CRYSTAL && e->timer > 600) { e->type = E_NONE; break; }
        if (e->timer > 8 && hero_touch(e, -1)) collect(e);
        break;
    case E_SHOPITEM: break;
    case E_BOMB:
        if (++e->timer >= 90) {
            e->type = E_EXPLOSION; e->timer = 0;
            e->x -= 8 * FP; e->y -= 8 * FP; e->w = 32; e->h = 32;
            explode(e);
        }
        break;
    case E_EXPLOSION:
        if (++e->timer >= 21) e->type = E_NONE;
        break;
    case E_ARROW: update_arrow(e); break;
    case E_BOOMERANG: update_boomerang(e); break;
    case E_SPORE: case E_FIREBALL:
        e->x += e->vx; e->y += e->vy;
        if (offroom(e)) { e->type = E_NONE; break; }
        if (e->type == E_SPORE && (props_at(ent_cx(e), ent_cy(e)) & TP_SOLID) && !(props_at(ent_cx(e), ent_cy(e)) & TP_WATER)) { e->type = E_NONE; break; }
        if (hero_touch(e, 2)) { hero_damage(1, ent_cx(e), ent_cy(e)); e->type = E_NONE; }
        break;
    case E_POOF:
        if (++e->timer >= 16) e->type = E_NONE;
        break;
    case E_SPARKLE:
        e->y -= 6;
        if (++e->timer >= 24) e->type = E_NONE;
        break;
    }
}

void ents_update(void)
{
    for (int i = 0; i < MAX_ENTS; i++) {
        ent_t *e = &G.ents[i];
        if (e->type == E_NONE) continue;
        if (IS_ENEMY(e->type)) update_enemy(e);
        else update_other(e);
        if (G.mode != MODE_PLAY) return;
    }
}

void sort_draw_order(void)
{
    int n = 0;
    for (int i = 0; i < MAX_ENTS; i++)
        if (G.ents[i].type != E_NONE) G.order[n++] = (uint8_t)i;
    /* insertion sort by bottom edge; flat effects first */
    for (int i = 1; i < n; i++) {
        uint8_t k = G.order[i];
        const ent_t *ek = &G.ents[k];
        int ky = (ek->y >> 4) + ek->h;
        int j = i - 1;
        while (j >= 0) {
            const ent_t *ej = &G.ents[G.order[j]];
            if ((ej->y >> 4) + ej->h <= ky) break;
            G.order[j + 1] = G.order[j];
            j--;
        }
        G.order[j + 1] = k;
    }
    G.norder = n;
}
