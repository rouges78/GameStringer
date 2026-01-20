cmake_minimum_required(VERSION 3.15)
project(UEAutoTranslator VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Output directory
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# MinHook - libreria per hooking
add_subdirectory(external/minhook)

# Sorgenti DLL
set(SOURCES
    src/main.cpp
)

set(HEADERS
    src/ipc_client.h
    src/text_hooks.h
)

# Crea DLL
add_library(${PROJECT_NAME} SHARED ${SOURCES} ${HEADERS})

# Link librerie
target_link_libraries(${PROJECT_NAME} PRIVATE
    minhook
    psapi  # Per GetModuleInformation
)

# Definizioni
target_compile_definitions(${PROJECT_NAME} PRIVATE
    UNICODE
    _UNICODE
    WIN32_LEAN_AND_MEAN
)

# Include directories
target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/external/minhook/include
)

# Fix per MinHook header path
file(COPY ${CMAKE_CURRENT_SOURCE_DIR}/external/minhook/include/MinHook.h
     DESTINATION ${CMAKE_CURRENT_SOURCE_DIR}/src/minhook/)

# Proprietà output
set_target_properties(${PROJECT_NAME} PROPERTIES
    OUTPUT_NAME "ue_auto_translator"
    SUFFIX ".dll"
)

# Post-build: copia DLL nella cartella resources di GameStringer
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory 
        "${CMAKE_CURRENT_SOURCE_DIR}/../src-tauri/resources/ue-translator"
    COMMAND ${CMAKE_COMMAND} -E copy 
        "$<TARGET_FILE:${PROJECT_NAME}>"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src-tauri/resources/ue-translator/"
    COMMENT "Copiando DLL in GameStringer resources..."
)

message(STATUS "UE AutoTranslator DLL configurata")
message(STATUS "Output: ${CMAKE_LIBRARY_OUTPUT_DIRECTORY}/ue_auto_translator.dll")
