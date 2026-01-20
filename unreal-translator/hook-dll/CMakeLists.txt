cmake_minimum_required(VERSION 3.20)
project(gs_translator VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Output directory
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# Source files
set(SOURCES
    src/dllmain.cpp
    src/hooks.cpp
    src/translator.cpp
    src/cache.cpp
    src/ipc.cpp
    src/utils.cpp
)

set(HEADERS
    include/hooks.h
    include/translator.h
    include/cache.h
    include/ipc.h
    include/utils.h
    include/ue_types.h
)

# Create DLL
add_library(gs_translator SHARED ${SOURCES} ${HEADERS})

# Include directories
target_include_directories(gs_translator PRIVATE 
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/deps/minhook/include
)

# Link MinHook for function hooking
add_subdirectory(deps/minhook)
target_link_libraries(gs_translator PRIVATE minhook)

# Windows specific
if(WIN32)
    target_compile_definitions(gs_translator PRIVATE 
        WIN32_LEAN_AND_MEAN
        NOMINMAX
        _CRT_SECURE_NO_WARNINGS
    )
endif()

# Build both x86 and x64
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
    set_target_properties(gs_translator PROPERTIES OUTPUT_NAME "gs_translator_x64")
else()
    set_target_properties(gs_translator PROPERTIES OUTPUT_NAME "gs_translator_x86")
endif()
