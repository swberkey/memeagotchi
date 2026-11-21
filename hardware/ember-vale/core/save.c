/* Ember Vale - save files in the host's flash folder.
 *
 *  save.dat     binary progress (magic "EVSV", version, length, checksum)
 *  wallet.json  {"coins":N,"lifetime_coins":M,"version":1}
 *               The host app may lower "coins" to cash them out; the game
 *               reads wallet.json at start-up and it wins over save.dat.
 *  status.json  read-only summary for the host (hearts, crystals, time).
 */
#include "ev_internal.h"

typedef struct { uint8_t *p; int n, cap; } wbuf_t;

static void w8(wbuf_t *b, uint32_t v) { if (b->n < b->cap) b->p[b->n++] = (uint8_t)v; }
static void w16(wbuf_t *b, uint32_t v) { w8(b, v); w8(b, v >> 8); }
static void w32(wbuf_t *b, uint32_t v) { w16(b, v); w16(b, v >> 16); }
static void wraw(wbuf_t *b, const uint8_t *d, int n) { for (int i = 0; i < n; i++) w8(b, d[i]); }

typedef struct { const uint8_t *p; int n, pos; } rbuf_t;
static uint32_t r8(rbuf_t *b) { return b->pos < b->n ? b->p[b->pos++] : 0; }
static uint32_t r16(rbuf_t *b) { uint32_t v = r8(b); return v | (r8(b) << 8); }
static uint32_t r32(rbuf_t *b) { uint32_t v = r16(b); return v | (r16(b) << 16); }
static void rraw(rbuf_t *b, uint8_t *d, int n) { for (int i = 0; i < n; i++) d[i] = (uint8_t)r8(b); }

static uint32_t checksum(const uint8_t *d, int n)
{
    uint32_t h = 2166136261u;
    for (int i = 0; i < n; i++) { h ^= d[i]; h *= 16777619u; }
    return h;
}

void progress_new(void)
{
    int32_t coins = G.p.coins, life = G.p.lifetime_coins;
    memset(&G.p, 0, sizeof G.p);
    G.p.coins = coins; G.p.lifetime_coins = life;
    G.p.max_hearts = 3;
    G.p.hp = 6;
    G.p.max_bombs = 10;
    G.p.max_arrows = 30;
    G.p.save_room = START_ROOM;
    G.p.save_x = START_X; G.p.save_y = START_Y; G.p.save_dir = D_DOWN;
}

static int put_str(char *o, int k, const char *s) { while (*s) o[k++] = *s++; return k; }
static int put_int(char *o, int k, int32_t v)
{
    char t[12]; int n = 0;
    if (v < 0) { o[k++] = '-'; v = -v; }
    do { t[n++] = (char)('0' + v % 10); v /= 10; } while (v);
    while (n) o[k++] = t[--n];
    return k;
}

static void write_file(const char *name, const void *d, uint32_t n)
{
    if (G.plat.file_write) G.plat.file_write(G.plat.user, name, d, n);
}

void save_all(void)
{
    if (G.mode == MODE_TITLE && !G.has_save) {
        /* nothing to save yet, but keep the wallet current */
    }
    uint8_t buf[160];
    wbuf_t b = {buf, 0, sizeof buf};
    progress_t *p = &G.p;
    wraw(&b, (const uint8_t *)"EVSV", 4);
    w16(&b, SAVE_VERSION);
    w16(&b, 0);                       /* payload length, patched below */
    w32(&b, 0);                       /* checksum, patched below */
    int start = b.n;
    w8(&b, p->max_hearts); w8(&b, p->hp);
    w8(&b, p->bombs); w8(&b, p->max_bombs); w8(&b, p->arrows); w8(&b, p->max_arrows);
    w8(&b, p->has_bow); w8(&b, p->has_boomerang); w8(&b, p->has_bombs); w8(&b, p->sel);
    wraw(&b, p->keys, 3);
    wraw(&b, p->flags, 32);
    wraw(&b, p->visited, 8);
    w32(&b, (uint32_t)p->coins); w32(&b, (uint32_t)p->lifetime_coins);
    w32(&b, p->play_frames); w16(&b, p->deaths); w8(&b, p->complete);
    w8(&b, p->save_room); w8(&b, p->save_dir); w16(&b, p->save_x); w16(&b, p->save_y);
    int len = b.n - start;
    buf[6] = (uint8_t)len; buf[7] = (uint8_t)(len >> 8);
    uint32_t c = checksum(buf + start, len);
    buf[8] = (uint8_t)c; buf[9] = (uint8_t)(c >> 8); buf[10] = (uint8_t)(c >> 16); buf[11] = (uint8_t)(c >> 24);
    write_file("save.dat", buf, (uint32_t)b.n);
    G.has_save = 1;

    char j[256];
    int k = 0;
    k = put_str(j, k, "{\"coins\":"); k = put_int(j, k, p->coins);
    k = put_str(j, k, ",\"lifetime_coins\":"); k = put_int(j, k, p->lifetime_coins);
    k = put_str(j, k, ",\"version\":1}\n");
    write_file("wallet.json", j, (uint32_t)k);

    int crystals = flag_get(FLAG_CRYSTAL1) + flag_get(FLAG_CRYSTAL2);
    k = 0;
    k = put_str(j, k, "{\"game\":\"ember_vale\",\"hearts\":"); k = put_int(j, k, p->max_hearts);
    k = put_str(j, k, ",\"crystals\":"); k = put_int(j, k, crystals);
    k = put_str(j, k, ",\"complete\":"); k = put_str(j, k, p->complete ? "true" : "false");
    k = put_str(j, k, ",\"play_seconds\":"); k = put_int(j, k, (int32_t)(p->play_frames / 60));
    k = put_str(j, k, ",\"deaths\":"); k = put_int(j, k, p->deaths);
    k = put_str(j, k, ",\"items\":{\"bombs\":"); k = put_str(j, k, p->has_bombs ? "true" : "false");
    k = put_str(j, k, ",\"bow\":"); k = put_str(j, k, p->has_bow ? "true" : "false");
    k = put_str(j, k, ",\"boomerang\":"); k = put_str(j, k, p->has_boomerang ? "true" : "false");
    k = put_str(j, k, "}}\n");
    write_file("status.json", j, (uint32_t)k);
}

static int json_int(const char *s, int n, const char *key, int32_t *out)
{
    int kl = 0;
    while (key[kl]) kl++;
    for (int i = 0; i + kl + 2 < n; i++) {
        if (s[i] != '"') continue;
        if (memcmp(s + i + 1, key, (size_t)kl) || s[i + 1 + kl] != '"') continue;
        int j = i + kl + 2;
        while (j < n && (s[j] == ' ' || s[j] == ':' || s[j] == '\t')) j++;
        int neg = 0;
        if (j < n && s[j] == '-') { neg = 1; j++; }
        if (j >= n || s[j] < '0' || s[j] > '9') return 0;
        int32_t v = 0;
        while (j < n && s[j] >= '0' && s[j] <= '9') { v = v * 10 + (s[j] - '0'); j++; }
        *out = neg ? -v : v;
        return 1;
    }
    return 0;
}

int load_all(void)
{
    int ok = 0;
    if (G.plat.file_read) {
        uint8_t buf[160];
        int32_t n = G.plat.file_read(G.plat.user, "save.dat", buf, sizeof buf);
        if (n >= 12 && !memcmp(buf, "EVSV", 4)) {
            int ver = buf[4] | buf[5] << 8, len = buf[6] | buf[7] << 8;
            uint32_t c = buf[8] | buf[9] << 8 | buf[10] << 16 | (uint32_t)buf[11] << 24;
            if (ver == SAVE_VERSION && 12 + len <= n && checksum(buf + 12, len) == c) {
                rbuf_t b = {buf + 12, len, 0};
                progress_t *p = &G.p;
                p->max_hearts = (uint8_t)r8(&b); p->hp = (uint8_t)r8(&b);
                p->bombs = (uint8_t)r8(&b); p->max_bombs = (uint8_t)r8(&b);
                p->arrows = (uint8_t)r8(&b); p->max_arrows = (uint8_t)r8(&b);
                p->has_bow = (uint8_t)r8(&b); p->has_boomerang = (uint8_t)r8(&b);
                p->has_bombs = (uint8_t)r8(&b); p->sel = (uint8_t)r8(&b);
                rraw(&b, p->keys, 3); rraw(&b, p->flags, 32); rraw(&b, p->visited, 8);
                p->coins = (int32_t)r32(&b); p->lifetime_coins = (int32_t)r32(&b);
                p->play_frames = r32(&b); p->deaths = (uint16_t)r16(&b); p->complete = (uint8_t)r8(&b);
                p->save_room = (uint8_t)r8(&b); p->save_dir = (uint8_t)r8(&b);
                p->save_x = (uint16_t)r16(&b); p->save_y = (uint16_t)r16(&b);
                if (p->save_room >= NUM_ROOMS || p->max_hearts < 3 || p->max_hearts > 20) progress_new();
                else ok = 1;
            }
        }
        char j[256];
        n = G.plat.file_read(G.plat.user, "wallet.json", j, sizeof j);
        if (n > 0) {
            int32_t v;
            if (json_int(j, n, "coins", &v) && v >= 0) G.p.coins = v > 99999 ? 99999 : v;
            if (json_int(j, n, "lifetime_coins", &v) && v >= G.p.lifetime_coins) G.p.lifetime_coins = v;
        }
    }
    return ok;
}
