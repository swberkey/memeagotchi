# Ember Vale as an ESP-IDF component.
#
# The portable game core lives in <repo>/core. If you copy this component
# into another project on its own, copy core/ into this folder as well
# (components/ember_vale/core) and it will be picked up from there.
if(EXISTS "${CMAKE_CURRENT_LIST_DIR}/core/ember_vale.h")
    set(EV_CORE "${CMAKE_CURRENT_LIST_DIR}/core")
else()
    get_filename_component(EV_CORE "${CMAKE_CURRENT_LIST_DIR}/../../../core" ABSOLUTE)
endif()

idf_component_register(
    SRCS "src/ember_vale_esp.c"
         "${EV_CORE}/game.c" "${EV_CORE}/entities.c" "${EV_CORE}/render.c" "${EV_CORE}/save.c"
         "${EV_CORE}/gen_assets.c" "${EV_CORE}/gen_world.c"
    INCLUDE_DIRS "include" "${EV_CORE}"
    REQUIRES esp_lcd driver esp_timer
    PRIV_REQUIRES esp_driver_gpio esp_driver_spi
)
# The core is plain C99; keep it warning-clean but quiet about generated tables.
target_compile_options(${COMPONENT_LIB} PRIVATE -O2 -Wno-unused-parameter)
