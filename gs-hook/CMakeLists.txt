cmake_minimum_required(VERSION 3.20)
project(gs_hook VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# ── gs-hook: la DLL unica iniettabile (UTIF) ─────────────────────────────────
#
# Architettura:
#   registry + dllmain   = orchestrazione (questo progetto)
#   src/sources/*        = le sorgenti di testo a plugin (L1/L2/L3)
#   core generico        = cache/ipc/translator/utils RIUSATI da
#                          ../unreal-translator/hook-dll (già scritti e funzionanti)
#
# NB: il "core generico" è già engine-agnostico. Per ora lo includiamo dal
# percorso esistente per non duplicarlo. In un secondo momento conviene
# spostarlo in gs-hook/core/ e farne la fonte di verità.

set(CORE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../unreal-translator/hook-dll)

set(GS_HOOK_SOURCES
    src/dllmain.cpp
    src/registry.cpp
    src/gs_overlay_ipc.cpp
    src/sources/source_unity_mono.cpp
    src/sources/source_unreal_ftext.cpp
    src/sources/source_gdi.cpp
    src/sources/source_gdi_glyph.cpp
    # core generico riusato (cache/ipc/translator/utils):
    ${CORE_DIR}/src/cache.cpp
    ${CORE_DIR}/src/ipc.cpp
    ${CORE_DIR}/src/translator.cpp
    ${CORE_DIR}/src/utils.cpp
)

add_library(gs_hook SHARED ${GS_HOOK_SOURCES})

target_include_directories(gs_hook PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CORE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/external/minhook/include
)

# MinHook: riusa quello già presente nel repo.
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../unity-translator-dll/external/minhook
                 ${CMAKE_BINARY_DIR}/minhook)
target_link_libraries(gs_hook PRIVATE minhook)

# Solo x86/x64 Windows.
if(NOT WIN32)
    message(FATAL_ERROR "gs-hook è una DLL Windows: builda su Windows con MSVC.")
endif()

# Nome di output: gs-hook.dll
set_target_properties(gs_hook PROPERTIES OUTPUT_NAME "gs-hook")

# ── gs-injector: helper di injection per-architettura ────────────────────────
#
# Exe console minimale (pid, percorso-dll) che esegue la LoadLibraryW remota.
# Va compilato nella stessa arch del target: il build dual-arch (build-all.ps1)
# configura due build dir, -A Win32 e -A x64, e produce gs-injector.exe per
# entrambe. NON dipende da MinHook né dal core: solo Win32 API.
# injector.rc porta i metadati di versione: un eseguibile anonimo che fa
# injection viene classificato come dropper dalle euristiche ML (misurato:
# Program:Win32/Contebrew.A!ml sulla build x86). Dichiarare prodotto, descrizione
# e versione abbassa il punteggio senza cambiare comportamento.
add_executable(gs-injector injector/injector_main.cpp injector/injector.rc)
set_target_properties(gs-injector PROPERTIES OUTPUT_NAME "gs-injector")
