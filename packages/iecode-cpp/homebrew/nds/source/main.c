#include <nds.h>
#include <iecode/homebrew.h>

#include <stdio.h>

uint32_t iecode_homebrew_abi_version(void) { return IECODE_HOMEBREW_ABI_VERSION; }

int iecode_homebrew_init(void) {
    consoleDemoInit();
    return 0;
}

void iecode_homebrew_shutdown(void) {}

uint32_t iecode_homebrew_screen_count(void) { return 2; }

int iecode_homebrew_get_screen(uint32_t index, iecode_home_screen *out_screen) {
    if (out_screen == NULL || index >= 2) return -1;
    out_screen->id = (uint8_t)index;
    out_screen->reserved[0] = 0;
    out_screen->reserved[1] = 0;
    out_screen->reserved[2] = 0;
    out_screen->width = 256;
    out_screen->height = 192;
    return 0;
}

void iecode_homebrew_poll_input(iecode_home_input *out_input) {
    if (out_input == NULL) return;
    scanKeys();
    const uint32_t keys = keysHeld();
    const uint32_t down = keysDown();
    out_input->held = 0;
    out_input->pressed = 0;
    out_input->reserved[0] = 0;
    out_input->reserved[1] = 0;
#define MAP_KEY(ds_key, common_key) \
    do { \
        if ((keys & (ds_key)) != 0) out_input->held |= (common_key); \
        if ((down & (ds_key)) != 0) out_input->pressed |= (common_key); \
    } while (0)
    MAP_KEY(KEY_A, IECODE_HOME_BUTTON_A);
    MAP_KEY(KEY_B, IECODE_HOME_BUTTON_B);
    MAP_KEY(KEY_X, IECODE_HOME_BUTTON_X);
    MAP_KEY(KEY_Y, IECODE_HOME_BUTTON_Y);
    MAP_KEY(KEY_START, IECODE_HOME_BUTTON_START);
    MAP_KEY(KEY_SELECT, IECODE_HOME_BUTTON_SELECT);
    MAP_KEY(KEY_UP, IECODE_HOME_BUTTON_UP);
    MAP_KEY(KEY_DOWN, IECODE_HOME_BUTTON_DOWN);
    MAP_KEY(KEY_LEFT, IECODE_HOME_BUTTON_LEFT);
    MAP_KEY(KEY_RIGHT, IECODE_HOME_BUTTON_RIGHT);
    MAP_KEY(KEY_L, IECODE_HOME_BUTTON_L);
    MAP_KEY(KEY_R, IECODE_HOME_BUTTON_R);
#undef MAP_KEY
    out_input->touch_valid = (keys & KEY_TOUCH) != 0;
    out_input->touch_screen = IECODE_HOME_SCREEN_BOTTOM;
    if (out_input->touch_valid) {
        touchPosition touch;
        touchRead(&touch);
        out_input->touch_x = touch.px;
        out_input->touch_y = touch.py;
    } else {
        out_input->touch_x = 0;
        out_input->touch_y = 0;
    }
}

void iecode_homebrew_wait_vblank(void) { swiWaitForVBlank(); }

int main(void) {
    iecode_home_input input = {0};
    (void)iecode_homebrew_init();
    printf("IECODE C ABI %lu\n", (unsigned long)iecode_homebrew_abi_version());
    printf("DS/DSi: dual 256x192 screens\nA/B/X/Y: buttons\nTouch the lower screen.\n");
    for (;;) {
        iecode_homebrew_poll_input(&input);
        if ((input.pressed & IECODE_HOME_BUTTON_START) != 0) break;
        iecode_homebrew_wait_vblank();
    }
    iecode_homebrew_shutdown();
    return 0;
}
