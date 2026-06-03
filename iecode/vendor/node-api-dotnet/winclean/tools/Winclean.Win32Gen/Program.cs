// Win32 → Bun binding generator.
//
// Reads the official Windows.Win32.winmd (Microsoft win32metadata) and emits
// typed bun:ffi binding tables, grouped by DLL, into the winclean-framework.
// This is the scalable path to "expose all of Windows to Bun": metadata-driven
// codegen instead of hand-written P/Invoke.
//
// Output per DLL: `export const user32 = loadModule("user32.dll", { ... } as const)`
// — a compact signature table; full TypeScript typing is derived generically
// by ./_runtime.ts from the `as const` literal.

using System.Collections.Immutable;
using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text;

// winmd path: arg → $NUGET_PACKAGES → ~/.nuget/packages (portable, no hard-coded user path).
string nugetCache = Environment.GetEnvironmentVariable("NUGET_PACKAGES")
    ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".nuget", "packages");
string winmd = args.Length > 0
    ? args[0]
    : Path.Combine(nugetCache, "microsoft.windows.sdk.win32metadata", "70.0.11-preview", "Windows.Win32.winmd");
// outDir: arg → packages/node-api-dotnet/winclean/win32 relative to CWD (run from repo root).
string outDir = args.Length > 1
    ? args[1]
    : Path.Combine(Directory.GetCurrentDirectory(), "packages", "node-api-dotnet", "winclean", "win32");

// Core, always-present-on-Win11 DLLs for v1. The generator handles any module;
// this allowlist just keeps the emitted surface focused and verifiable.
var allow = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "kernel32", "user32", "gdi32", "advapi32", "shell32", "shlwapi",
    "dwmapi", "ole32", "comdlg32", "winmm", "psapi", "version", "gdiplus",
};

using var fs = File.OpenRead(winmd);
using var pe = new PEReader(fs);
MetadataReader mr = pe.GetMetadataReader();

// Map "Namespace.Name" -> TypeDefinition, for resolving TypeRefs to handles/enums.
var byName = new Dictionary<string, TypeDefinitionHandle>(StringComparer.Ordinal);
foreach (TypeDefinitionHandle h in mr.TypeDefinitions)
{
    TypeDefinition td = mr.GetTypeDefinition(h);
    string key = mr.GetString(td.Namespace) + "." + mr.GetString(td.Name);
    byName[key] = h;
}

var provider = new FfiProvider(mr, byName);

// dll(lowercase) -> (functionName -> (argCodes, retCode))
var modules = new Dictionary<string, SortedDictionary<string, (List<string> Args, string Ret)>>(StringComparer.Ordinal);
int total = 0, emitted = 0, skipped = 0;

foreach (TypeDefinitionHandle typeHandle in mr.TypeDefinitions)
{
    TypeDefinition type = mr.GetTypeDefinition(typeHandle);
    if (mr.GetString(type.Name) != "Apis")
    {
        continue;
    }

    foreach (MethodDefinitionHandle methodHandle in type.GetMethods())
    {
        MethodDefinition method = mr.GetMethodDefinition(methodHandle);
        if ((method.Attributes & MethodAttributes.PinvokeImpl) == 0)
        {
            continue;
        }

        MethodImport import = method.GetImport();
        if (import.Module.IsNil)
        {
            continue;
        }

        string moduleName = mr.GetString(mr.GetModuleReference(import.Module).Name);
        string dllBase = moduleName.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)
            ? moduleName[..^4]
            : moduleName;
        if (!allow.Contains(dllBase))
        {
            continue;
        }

        total++;
        string fnName = mr.GetString(method.Name);
        MethodSignature<string> sig;
        try
        {
            sig = method.DecodeSignature(provider, null);
        }
        catch
        {
            skipped++;
            continue;
        }

        if (sig.ReturnType is "?" || sig.ParameterTypes.Any(p => p is "?" or "void"))
        {
            skipped++;
            continue;
        }

        string dllKey = dllBase.ToLowerInvariant();
        if (!modules.TryGetValue(dllKey, out var fns))
        {
            fns = new SortedDictionary<string, (List<string>, string)>(StringComparer.Ordinal);
            modules[dllKey] = fns;
        }
        if (fns.ContainsKey(fnName))
        {
            continue; // first definition wins (A/W and arch variants share base logic)
        }
        fns[fnName] = (sig.ParameterTypes.ToList(), sig.ReturnType);
        emitted++;
    }
}

Directory.CreateDirectory(outDir);
var index = new StringBuilder();
index.AppendLine("// AUTO-GENERATED from Windows.Win32.winmd — do not edit by hand.");
index.AppendLine("// Typed bun:ffi bindings for the core Win32 surface. Regenerate: dotnet run --project src/Winclean.Win32Gen");
index.AppendLine();

foreach ((string dll, var fns) in modules.OrderBy(kv => kv.Key, StringComparer.Ordinal))
{
    var sb = new StringBuilder();
    sb.AppendLine("// AUTO-GENERATED from Windows.Win32.winmd — do not edit by hand.");
    sb.AppendLine("import { loadModule } from \"./_runtime\";");
    sb.AppendLine();
    sb.Append("export const ").Append(dll).Append(" = loadModule(\"").Append(dll).AppendLine(".dll\", {");
    foreach ((string name, (List<string> a, string r)) in fns)
    {
        sb.Append("  \"").Append(name).Append("\": { a: [")
          .Append(string.Join(", ", a.Select(x => "\"" + x + "\"")))
          .Append("], r: \"").Append(r).AppendLine("\" },");
    }
    sb.AppendLine("} as const);");
    File.WriteAllText(Path.Combine(outDir, dll + ".gen.ts"), sb.ToString());

    index.Append("export { ").Append(dll).Append(" } from \"./").Append(dll).AppendLine(".gen\";");
    Console.WriteLine($"{dll,-10} {fns.Count,5} functions");
}

File.WriteAllText(Path.Combine(outDir, "index.ts"), index.ToString());
Console.WriteLine($"\nTotal P/Invoke (allowlisted DLLs): {total} | emitted: {emitted} | skipped (unsupported sig): {skipped}");
Console.WriteLine($"Output: {outDir}");

// Maps winmd types to FFI type-code strings ("u32","ptr",…); "?" = unsupported.
internal sealed class FfiProvider : ISignatureTypeProvider<string, object?>
{
    private readonly MetadataReader _mr;
    private readonly Dictionary<string, TypeDefinitionHandle> _byName;
    private readonly Dictionary<TypeDefinitionHandle, string> _cache = new();
    private readonly HashSet<TypeDefinitionHandle> _inProgress = new();

    public FfiProvider(MetadataReader mr, Dictionary<string, TypeDefinitionHandle> byName)
    {
        _mr = mr;
        _byName = byName;
    }

    public string GetPrimitiveType(PrimitiveTypeCode code) => code switch
    {
        PrimitiveTypeCode.Void => "void",
        PrimitiveTypeCode.Boolean => "bool",
        PrimitiveTypeCode.Char => "u16",
        PrimitiveTypeCode.SByte => "i8",
        PrimitiveTypeCode.Byte => "u8",
        PrimitiveTypeCode.Int16 => "i16",
        PrimitiveTypeCode.UInt16 => "u16",
        PrimitiveTypeCode.Int32 => "i32",
        PrimitiveTypeCode.UInt32 => "u32",
        PrimitiveTypeCode.Int64 => "i64",
        PrimitiveTypeCode.UInt64 => "u64",
        PrimitiveTypeCode.Single => "f32",
        PrimitiveTypeCode.Double => "f64",
        // Per Bun's bun:ffi docs: Windows HANDLE/pointer-sized opaque values
        // (IntPtr/UIntPtr — HWND, HDC, HANDLE, WPARAM, LPARAM, LRESULT…) must be
        // u64, NOT ptr — `ptr` triggers pointer validation and won't work. Real
        // pointer types (T*, void*, char*) still map to ptr via GetPointerType.
        PrimitiveTypeCode.IntPtr => "u64",
        PrimitiveTypeCode.UIntPtr => "u64",
        _ => "?",
    };

    public string GetPointerType(string elementType) => "ptr";
    public string GetByReferenceType(string elementType) => "ptr";
    public string GetSZArrayType(string elementType) => "ptr";
    public string GetArrayType(string elementType, ArrayShape shape) => "ptr";
    public string GetFunctionPointerType(MethodSignature<string> signature) => "ptr";
    public string GetModifiedType(string modifier, string unmodifiedType, bool isRequired) => unmodifiedType;
    public string GetPinnedType(string elementType) => elementType;
    public string GetGenericInstantiation(string genericType, ImmutableArray<string> typeArguments) => "?";
    public string GetGenericMethodParameter(object? genericContext, int index) => "?";
    public string GetGenericTypeParameter(object? genericContext, int index) => "?";
    public string GetTypeFromSpecification(MetadataReader reader, object? genericContext, TypeSpecificationHandle handle, byte rawTypeKind) => "?";

    public string GetTypeFromDefinition(MetadataReader reader, TypeDefinitionHandle handle, byte rawTypeKind)
        => ResolveTypeDef(handle);

    public string GetTypeFromReference(MetadataReader reader, TypeReferenceHandle handle, byte rawTypeKind)
    {
        TypeReference tr = _mr.GetTypeReference(handle);
        string key = _mr.GetString(tr.Namespace) + "." + _mr.GetString(tr.Name);
        return _byName.TryGetValue(key, out TypeDefinitionHandle td) ? ResolveTypeDef(td) : "?";
    }

    // A native typedef (HWND, HRESULT, PWSTR, an enum…) collapses to the FFI type
    // of its single instance field (enums: value__). Real multi-field structs are
    // unsupported as by-value FFI args → "?".
    private string ResolveTypeDef(TypeDefinitionHandle handle)
    {
        if (_cache.TryGetValue(handle, out string? cached))
        {
            return cached;
        }
        if (!_inProgress.Add(handle))
        {
            return "?"; // cycle
        }

        string result = "?";
        TypeDefinition td = _mr.GetTypeDefinition(handle);
        FieldDefinitionHandle? only = null;
        int instanceCount = 0;
        foreach (FieldDefinitionHandle fh in td.GetFields())
        {
            FieldDefinition fd = _mr.GetFieldDefinition(fh);
            if ((fd.Attributes & FieldAttributes.Static) != 0)
            {
                continue;
            }
            instanceCount++;
            only = fh;
        }

        if (instanceCount == 1 && only is FieldDefinitionHandle f)
        {
            // Integer-backed typedefs (UINT_PTR/INT_PTR → WPARAM, LPARAM, LRESULT…)
            // resolve to u64 here (per bun:ffi, pointer-sized integers must be u64,
            // not ptr). Pointer-backed handles (HWND, HDC = void*) stay ptr — they
            // work as ptr in practice and keep the framework's HWND handling
            // uniform (dwm/winui/uia all use ptr).
            result = _mr.GetFieldDefinition(f).DecodeSignature(this, null);
        }

        _inProgress.Remove(handle);
        _cache[handle] = result;
        return result;
    }
}
