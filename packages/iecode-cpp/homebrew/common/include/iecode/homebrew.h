#ifndef IECODE_HOMEBREW_H
#define IECODE_HOMEBREW_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define IECODE_HOMEBREW_ABI_VERSION 1u
#define IECODE_HOME_BUTTON_A       (1u << 0)
#define IECODE_HOME_BUTTON_B       (1u << 1)
#define IECODE_HOME_BUTTON_X       (1u << 2)
#define IECODE_HOME_BUTTON_Y       (1u << 3)
#define IECODE_HOME_BUTTON_START   (1u << 4)
#define IECODE_HOME_BUTTON_SELECT  (1u << 5)
#define IECODE_HOME_BUTTON_UP      (1u << 6)
#define IECODE_HOME_BUTTON_DOWN    (1u << 7)
#define IECODE_HOME_BUTTON_LEFT    (1u << 8)
#define IECODE_HOME_BUTTON_RIGHT   (1u << 9)
#define IECODE_HOME_BUTTON_L       (1u << 10)
#define IECODE_HOME_BUTTON_R       (1u << 11)

typedef enum iecode_home_screen_id {
    IECODE_HOME_SCREEN_TOP = 0,
    IECODE_HOME_SCREEN_BOTTOM = 1
} iecode_home_screen_id;

typedef struct iecode_home_screen {
    uint16_t width;
    uint16_t height;
    uint8_t id;
    uint8_t reserved[3];
} iecode_home_screen;

typedef struct iecode_home_input {
    uint32_t held;
    uint32_t pressed;
    uint8_t touch_valid;
    uint8_t touch_screen;
    uint8_t reserved[2];
    uint16_t touch_x;
    uint16_t touch_y;
} iecode_home_input;

/* Platform implementations live in the target-specific DS and 3DS projects. */
uint32_t iecode_homebrew_abi_version(void);
int iecode_homebrew_init(void);
void iecode_homebrew_shutdown(void);
uint32_t iecode_homebrew_screen_count(void);
int iecode_homebrew_get_screen(uint32_t index, iecode_home_screen *out_screen);
void iecode_homebrew_poll_input(iecode_home_input *out_input);
void iecode_homebrew_wait_vblank(void);

#ifdef __cplusplus
}
#endif

#endif
