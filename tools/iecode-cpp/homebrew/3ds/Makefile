ifeq ($(strip $(DEVKITARM)),)
$(error DEVKITARM is not set; install devkitPro devkitARM and 3ds-dev)
endif
ifeq ($(strip $(DEVKITPRO)),)
$(error DEVKITPRO is not set; install devkitPro)
endif

BUILD := build
TARGET := $(BUILD)/iecode_homebrew_3ds
SOURCES := source
INCLUDES := ../common/include
CTRULIB ?= $(DEVKITPRO)/libctru
ARCH := -march=armv6k -mtune=mpcore -mfloat-abi=hard -mtp=soft
CFLAGS := -g -Wall -Wextra -O2 -mword-relocations -ffunction-sections $(ARCH)
CFLAGS += $(addprefix -I,$(INCLUDES)) -I$(CTRULIB)/include -D__3DS__
LDFLAGS := -specs=3dsx.specs -g $(ARCH) -Wl,-Map,$(TARGET).map -L$(CTRULIB)/lib
LIBS := -lctru -lm

include $(DEVKITARM)/3ds_rules

CFILES := $(wildcard $(SOURCES)/*.c)
OBJECTS := $(patsubst $(SOURCES)/%.c,$(BUILD)/%.o,$(CFILES))

.PHONY: all clean

all: $(TARGET).3dsx

$(BUILD)/%.o: $(SOURCES)/%.c
	@mkdir -p $(BUILD)
	arm-none-eabi-gcc -MMD -MP -MF $(@:.o=.d) $(CFLAGS) -c $< -o $@

$(TARGET).elf: $(OBJECTS)
	arm-none-eabi-gcc $(LDFLAGS) $(OBJECTS) $(LIBS) -o $@

clean:
	rm -rf $(BUILD)

-include $(OBJECTS:.o=.d)
