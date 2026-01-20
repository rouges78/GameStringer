cmake_minimum_required(VERSION 3.15)
project(UnityAutoTranslator VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

add_subdirectory(external/minhook)

set(SOURCES src/main.cpp)
set(HEADERS src/ipc_client.h)

add_library(${PROJECT_NAME} SHARED ${SOURCES} ${HEADERS})

target_link_libraries(${PROJECT_NAME} PRIVATE minhook)

target_compile_definitions(${PROJECT_NAME} PRIVATE
    UNICODE _UNICODE WIN32_LEAN_AND_MEAN
)

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/external/minhook/include
)

set_target_properties(${PROJECT_NAME} PROPERTIES
    OUTPUT_NAME "unity_auto_translator"
    SUFFIX ".dll"
)

add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory 
        "${CMAKE_CURRENT_SOURCE_DIR}/../src-tauri/resources/unity-translator"
    COMMAND ${CMAKE_COMMAND} -E copy 
        "$<TARGET_FILE:${PROJECT_NAME}>"
        "${CMAKE_CURRENT_SOURCE_DIR}/../src-tauri/resources/unity-translator/"
)
