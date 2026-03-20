#include "factory.hpp"
#include "command.hpp"
#include <new>

CClassFactory::CClassFactory() : _cRef(1) {}

STDMETHODIMP CClassFactory::QueryInterface(REFIID riid, void** ppv) {
    if (!ppv) return E_POINTER;
    if (IsEqualIID(riid, IID_IUnknown) ||
        IsEqualIID(riid, IID_IClassFactory)) {
        *ppv = static_cast<IClassFactory*>(this);
        AddRef();
        return S_OK;
    }
    *ppv = nullptr;
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) CClassFactory::AddRef() {
    return InterlockedIncrement(&_cRef);
}

STDMETHODIMP_(ULONG) CClassFactory::Release() {
    long cRef = InterlockedDecrement(&_cRef);
    if (cRef == 0) delete this;
    return static_cast<ULONG>(cRef);
}

STDMETHODIMP CClassFactory::CreateInstance(IUnknown* pUnkOuter, REFIID riid, void** ppv) {
    if (pUnkOuter) return CLASS_E_NOAGGREGATION;

    CClaudeCommand* pCmd = new (std::nothrow) CClaudeCommand();
    if (!pCmd) return E_OUTOFMEMORY;

    HRESULT hr = pCmd->QueryInterface(riid, ppv);
    pCmd->Release();
    return hr;
}

STDMETHODIMP CClassFactory::LockServer(BOOL fLock) {
    if (fLock) InterlockedIncrement(&g_cDllRef);
    else       InterlockedDecrement(&g_cDllRef);
    return S_OK;
}
