// Bun XAML Host — a minimal WinUI 3 process that renders XAML supplied by Bun.
//
// Bun (which cannot host XAML in-process) pipes JSON commands over stdin; this
// host parses arbitrary XAML markup at runtime via XamlReader.Load, shows it in
// a Window, wires interactive controls, and streams events back over stdout.
// One JSON object per line, both directions.
//
//   Bun -> host : {"id":1,"cmd":"setContent","xaml":"<StackPanel>...</StackPanel>"}
//   host -> Bun : {"type":"result","id":1,"ok":true,"value":true}
//   host -> Bun : {"type":"event","event":"click","name":"btnOk"}

using System;
using System.Text;
using System.Text.Json;
using System.Threading;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Markup;
using Windows.Graphics;

namespace Winclean.XamlHost;

public partial class App : Application
{
    private Window? _window;
    private DispatcherQueue? _dispatcher;
    private FrameworkElement? _root;
    private static readonly object OutLock = new();

    public App() => this.InitializeComponent();

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _window = new Window { Title = "Bun XAML Host" };
        _dispatcher = _window.DispatcherQueue;
        Resize(900, 650);
        _window.Activate();
        Emit("{\"type\":\"ready\"}");

        var reader = new Thread(StdinLoop) { IsBackground = true, Name = "stdin" };
        reader.Start();
    }

    private void StdinLoop()
    {
        string? line;
        while ((line = Console.ReadLine()) is not null)
        {
            if (line.Length == 0)
            {
                continue;
            }
            string captured = line;
            _dispatcher?.TryEnqueue(() => Dispatch(captured));
        }
        // stdin closed (Bun went away) → shut down.
        _dispatcher?.TryEnqueue(() => Environment.Exit(0));
    }

    private void Dispatch(string line)
    {
        string idRaw = "null";
        try
        {
            using var doc = JsonDocument.Parse(line);
            JsonElement root = doc.RootElement;
            if (root.TryGetProperty("id", out JsonElement idEl))
            {
                idRaw = idEl.GetRawText();
            }
            object? result = Handle(root.GetProperty("cmd").GetString(), root);
            Respond(idRaw, true, result, null);
        }
        catch (Exception ex)
        {
            Respond(idRaw, false, null, ex.Message);
        }
    }

    private object? Handle(string? cmd, JsonElement root)
    {
        switch (cmd)
        {
            case "ping":
                return "pong";

            case "setTitle":
                if (_window is not null)
                {
                    _window.Title = root.GetProperty("title").GetString() ?? "";
                }
                return true;

            case "resize":
                Resize(root.GetProperty("w").GetInt32(), root.GetProperty("h").GetInt32());
                return true;

            case "setContent":
            {
                string xaml = root.GetProperty("xaml").GetString() ?? "";
                object parsed = XamlReader.Load(xaml);
                _root = parsed as FrameworkElement
                    ?? throw new InvalidOperationException("root XAML is not a FrameworkElement");
                if (_window is not null)
                {
                    _window.Content = _root;
                }
                WireEvents(_root);
                return true;
            }

            case "setText":
            {
                FrameworkElement el = Resolve(root.GetProperty("name").GetString());
                SetText(el, root.GetProperty("value").GetString() ?? "");
                return true;
            }

            case "getText":
                return GetText(Resolve(root.GetProperty("name").GetString()));

            default:
                throw new ArgumentException("unknown cmd: " + cmd);
        }
    }

    private FrameworkElement Resolve(string? name)
    {
        if (string.IsNullOrEmpty(name) || _root is null)
        {
            throw new ArgumentException("name required and content must be set");
        }
        return _root.FindName(name) as FrameworkElement
            ?? throw new InvalidOperationException("no element named '" + name + "'");
    }

    private void Resize(int width, int height)
    {
        if (_window is null)
        {
            return;
        }
        nint hwnd = WinRT.Interop.WindowNative.GetWindowHandle(_window);
        Microsoft.UI.WindowId id = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
        Microsoft.UI.Windowing.AppWindow.GetFromWindowId(id).Resize(new SizeInt32(width, height));
    }

    // Recursively attach handlers to interactive controls and forward to Bun.
    private void WireEvents(object? node)
    {
        switch (node)
        {
            case null:
                return;

            case Button button:
                button.Click += (_, _) => EmitEvent("click", button.Name);
                break;

            case ToggleSwitch toggle:
                toggle.Toggled += (_, _) => EmitEvent("toggle", toggle.Name, toggle.IsOn);
                break;

            case CheckBox check:
                check.Checked += (_, _) => EmitEvent("toggle", check.Name, true);
                check.Unchecked += (_, _) => EmitEvent("toggle", check.Name, false);
                break;

            case TextBox text:
                text.TextChanged += (_, _) => EmitEvent("text", text.Name, text.Text);
                break;
        }

        switch (node)
        {
            case Panel panel:
                foreach (UIElement child in panel.Children)
                {
                    WireEvents(child);
                }
                break;
            case Border border:
                WireEvents(border.Child);
                break;
            case ScrollViewer scroll:
                WireEvents(scroll.Content);
                break;
            case ContentControl content:
                WireEvents(content.Content);
                break;
        }
    }

    private static void SetText(FrameworkElement el, string value)
    {
        switch (el)
        {
            case TextBlock tb: tb.Text = value; break;
            case TextBox txt: txt.Text = value; break;
            case ContentControl cc: cc.Content = value; break;
            default: throw new InvalidOperationException("element is not text-settable");
        }
    }

    private static object GetText(FrameworkElement el) => el switch
    {
        TextBlock tb => tb.Text,
        TextBox txt => txt.Text,
        ToggleSwitch ts => ts.IsOn,
        CheckBox cb => cb.IsChecked ?? false,
        ContentControl cc => cc.Content?.ToString() ?? "",
        _ => "",
    };

    private static void EmitEvent(string ev, string? name, object? value = null)
    {
        var sb = new StringBuilder();
        sb.Append("{\"type\":\"event\",\"event\":").Append(JsonSerializer.Serialize(ev))
          .Append(",\"name\":").Append(JsonSerializer.Serialize(name ?? ""));
        if (value is not null)
        {
            sb.Append(",\"value\":").Append(JsonSerializer.Serialize(value));
        }
        sb.Append('}');
        Emit(sb.ToString());
    }

    private static void Respond(string idRaw, bool ok, object? value, string? error)
    {
        var sb = new StringBuilder();
        sb.Append("{\"type\":\"result\",\"id\":").Append(idRaw).Append(",\"ok\":").Append(ok ? "true" : "false");
        if (ok)
        {
            sb.Append(",\"value\":").Append(JsonSerializer.Serialize(value));
        }
        else
        {
            sb.Append(",\"error\":").Append(JsonSerializer.Serialize(error));
        }
        sb.Append('}');
        Emit(sb.ToString());
    }

    private static void Emit(string json)
    {
        lock (OutLock)
        {
            Console.Out.WriteLine(json);
            Console.Out.Flush();
        }
    }
}
