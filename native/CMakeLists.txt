cmake_minimum_required(VERSION 3.20)
project(ClaudeContextMenu CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(claude-context-menu SHARED
    src/dllmain.cpp
    src/command.hpp
    src/command.cpp
    src/factory.hpp
    src/factory.cpp
    exports.def
)

target_compile_definitions(claude-context-menu PRIVATE
    NOMINMAX
    UNICODE
    _UNICODE
)

target_link_libraries(claude-context-menu PRIVATE
    shlwapi
    ole32
    shell32
)

# Output directly to prebuilt/
set(PREBUILT "${CMAKE_SOURCE_DIR}/../prebuilt")

set_target_properties(claude-context-menu PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY                "${PREBUILT}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE        "${PREBUILT}"
    RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${PREBUILT}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG          "${PREBUILT}/debug"
    LIBRARY_OUTPUT_DIRECTORY                "${PREBUILT}"
    LIBRARY_OUTPUT_DIRECTORY_RELEASE        "${PREBUILT}"
    # Don't ship the import lib
    ARCHIVE_OUTPUT_DIRECTORY                "${CMAKE_BINARY_DIR}/lib"
)
