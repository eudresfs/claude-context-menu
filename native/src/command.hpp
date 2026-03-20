#pragma once
#define NOMINMAX
#include <windows.h>
#include <shobjidl_core.h>
#include <shlwapi.h>
#include <string>

extern long g_cDllRef;

// {3A8E2F91-6B47-4C5D-9E0A-1F2B3C4D5E6F}
inline constexpr CLSID CLSID_ClaudeCommand =
    {0x3A8E2F91, 0x6B47, 0x4C5D, {0x9E, 0x0A, 0x1F, 0x2B, 0x3C, 0x4D, 0x5E, 0x6F}};

struct Config {
    std::wstring label;
    std::wstring shell;
    std::wstring extraFlags;
    std::wstring claudePath;
    bool         useWt;
    std::wstring wtPath;
};

bool ReadConfig(Config& cfg);

class CClaudeCommand : public IExplorerCommand
{
public:
    CClaudeCommand();

    // IUnknown
    STDMETHODIMP         QueryInterface(REFIID riid, void** ppv) override;
    STDMETHODIMP_(ULONG) AddRef()  override;
    STDMETHODIMP_(ULONG) Release() override;

    // IExplorerCommand
    STDMETHODIMP GetTitle(IShellItemArray* psia, LPWSTR* ppszName)         override;
    STDMETHODIMP GetIcon(IShellItemArray* psia, LPWSTR* ppszIcon)          override;
    STDMETHODIMP GetToolTip(IShellItemArray* psia, LPWSTR* ppszInfotip)    override;
    STDMETHODIMP GetCanonicalName(GUID* pguidCommandName)                  override;
    STDMETHODIMP GetState(IShellItemArray* psia, BOOL fOkToBeSlow,
                          EXPCMDSTATE* pCmdState)                          override;
    STDMETHODIMP Invoke(IShellItemArray* psia, IBindCtx* pbc)              override;
    STDMETHODIMP GetFlags(EXPCMDFLAGS* pFlags)                             override;
    STDMETHODIMP EnumSubCommands(IEnumExplorerCommand** ppEnum)            override;

private:
    ~CClaudeCommand();
    long _cRef;
};
