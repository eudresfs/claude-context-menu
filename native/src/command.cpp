#include "command.hpp"
#include <vector>
#include <string>

// ── Config ────────────────────────────────────────────────────────────────────

bool ReadConfig(Config& cfg) {
    HKEY hKey;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\ClaudeContextMenu",
                      0, KEY_READ, &hKey) != ERROR_SUCCESS)
        return false;

    auto readStr = [&](const wchar_t* name) -> std::wstring {
        WCHAR buf[1024] = {};
        DWORD sz = sizeof(buf);
        DWORD type = REG_SZ;
        if (RegQueryValueExW(hKey, name, nullptr, &type,
                             reinterpret_cast<LPBYTE>(buf), &sz) == ERROR_SUCCESS)
            return std::wstring(buf);
        return {};
    };

    auto readDword = [&](const wchar_t* name) -> DWORD {
        DWORD val = 0, sz = sizeof(val), type = REG_DWORD;
        RegQueryValueExW(hKey, name, nullptr, &type,
                         reinterpret_cast<LPBYTE>(&val), &sz);
        return val;
    };

    cfg.label      = readStr(L"Label");
    cfg.shell      = readStr(L"Shell");
    cfg.extraFlags = readStr(L"ExtraFlags");
    cfg.claudePath = readStr(L"ClaudePath");
    cfg.useWt      = readDword(L"UseWindowsTerminal") != 0;
    cfg.wtPath     = readStr(L"WtPath");

    RegCloseKey(hKey);
    return !cfg.shell.empty();
}

// ── CClaudeCommand ────────────────────────────────────────────────────────────

CClaudeCommand::CClaudeCommand() : _cRef(1) {
    InterlockedIncrement(&g_cDllRef);
}

CClaudeCommand::~CClaudeCommand() {
    InterlockedDecrement(&g_cDllRef);
}

STDMETHODIMP CClaudeCommand::QueryInterface(REFIID riid, void** ppv) {
    if (!ppv) return E_POINTER;
    if (IsEqualIID(riid, IID_IUnknown) ||
        IsEqualIID(riid, IID_IExplorerCommand)) {
        *ppv = static_cast<IExplorerCommand*>(this);
        AddRef();
        return S_OK;
    }
    *ppv = nullptr;
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) CClaudeCommand::AddRef() {
    return InterlockedIncrement(&_cRef);
}

STDMETHODIMP_(ULONG) CClaudeCommand::Release() {
    long cRef = InterlockedDecrement(&_cRef);
    if (cRef == 0) delete this;
    return static_cast<ULONG>(cRef);
}

STDMETHODIMP CClaudeCommand::GetTitle(IShellItemArray*, LPWSTR* ppszName) {
    Config cfg;
    const wchar_t* label = (ReadConfig(cfg) && !cfg.label.empty())
                           ? cfg.label.c_str()
                           : L"Open with Claude";
    return SHStrDupW(label, ppszName);
}

STDMETHODIMP CClaudeCommand::GetIcon(IShellItemArray*, LPWSTR* ppszIcon) {
    Config cfg;
    if (!ReadConfig(cfg) || cfg.claudePath.empty()) {
        *ppszIcon = nullptr;
        return E_FAIL;
    }
    std::wstring icon = cfg.claudePath + L",0";
    return SHStrDupW(icon.c_str(), ppszIcon);
}

STDMETHODIMP CClaudeCommand::GetToolTip(IShellItemArray*, LPWSTR* ppszInfotip) {
    *ppszInfotip = nullptr;
    return E_NOTIMPL;
}

STDMETHODIMP CClaudeCommand::GetCanonicalName(GUID* pguidCommandName) {
    *pguidCommandName = CLSID_ClaudeCommand;
    return S_OK;
}

STDMETHODIMP CClaudeCommand::GetState(IShellItemArray*, BOOL, EXPCMDSTATE* pCmdState) {
    *pCmdState = ECS_ENABLED;
    return S_OK;
}

STDMETHODIMP CClaudeCommand::GetFlags(EXPCMDFLAGS* pFlags) {
    *pFlags = ECF_DEFAULT;
    return S_OK;
}

STDMETHODIMP CClaudeCommand::EnumSubCommands(IEnumExplorerCommand** ppEnum) {
    *ppEnum = nullptr;
    return E_NOTIMPL;
}

STDMETHODIMP CClaudeCommand::Invoke(IShellItemArray* psia, IBindCtx*) {
    if (!psia) return E_INVALIDARG;

    IShellItem* psi = nullptr;
    HRESULT hr = psia->GetItemAt(0, &psi);
    if (FAILED(hr)) return hr;

    PWSTR pszPath = nullptr;
    hr = psi->GetDisplayName(SIGDN_FILESYSPATH, &pszPath);
    psi->Release();
    if (FAILED(hr)) return hr;

    std::wstring path(pszPath);
    CoTaskMemFree(pszPath);

    Config cfg;
    if (!ReadConfig(cfg)) return E_FAIL;

    // Build PowerShell/pwsh command
    std::wstring claudeCmd = L"claude";
    if (!cfg.extraFlags.empty())
        claudeCmd += L" " + cfg.extraFlags;

    std::wstring cmdLine;
    if (cfg.useWt && !cfg.wtPath.empty()) {
        // Windows Terminal: handles directory via -d flag
        cmdLine = L"\"" + cfg.wtPath + L"\" new-tab -d \"" + path +
                  L"\" \"" + cfg.shell + L"\" -NoExit -Command \"" + claudeCmd + L"\"";
    } else {
        // Escape single quotes in path for PowerShell single-quoted string
        std::wstring escaped;
        for (wchar_t ch : path) {
            if (ch == L'\'') escaped += L"''";
            else             escaped += ch;
        }
        cmdLine = L"\"" + cfg.shell +
                  L"\" -NoExit -Command \"Set-Location '" + escaped +
                  L"'; " + claudeCmd + L"\"";
    }

    // CreateProcess needs a mutable buffer
    std::vector<wchar_t> buf(cmdLine.begin(), cmdLine.end());
    buf.push_back(L'\0');

    STARTUPINFOW si = {};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi = {};

    BOOL ok = CreateProcessW(
        nullptr, buf.data(),
        nullptr, nullptr, FALSE,
        CREATE_NEW_CONSOLE,
        nullptr, path.c_str(),   // inherit nothing; start in the clicked folder
        &si, &pi
    );

    if (!ok) return HRESULT_FROM_WIN32(GetLastError());

    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return S_OK;
}
