// JSON-over-stdio UI Automation bridge for Bun.
//
// Bun spawns this helper and pipes one JSON command per stdin line; the bridge
// replies with one JSON result line. It drives a running WinUI 3 (or any UIA)
// app via System.Windows.Automation, which Bun cannot call directly.
//
// Commands: ping | snapshot | invoke | getValue | setValue | toggle
// Selectors: "name" or "automationId" (plus "hwnd" for the target window).

using System.Globalization;
using System.Text.Json;
using System.Windows.Automation;

string? line;
while ((line = Console.ReadLine()) is not null)
{
    if (line.Length == 0)
    {
        continue;
    }
    string response;
    try
    {
        using var doc = JsonDocument.Parse(line);
        response = Handle(doc.RootElement);
    }
    catch (Exception ex)
    {
        response = Err(ex.Message);
    }
    Console.Out.WriteLine(response);
    Console.Out.Flush();
}

static string Ok(string resultJson) => "{\"ok\":true,\"result\":" + resultJson + "}";

static string Err(string message) => "{\"ok\":false,\"error\":" + JsonSerializer.Serialize(message) + "}";

static AutomationElement Window(JsonElement root)
{
    long hwnd = root.GetProperty("hwnd").GetInt64();
    return AutomationElement.FromHandle(new IntPtr(hwnd))
        ?? throw new InvalidOperationException("no window for hwnd " + hwnd);
}

static AutomationElement Find(JsonElement root)
{
    AutomationElement win = Window(root);
    Condition cond;
    if (root.TryGetProperty("name", out JsonElement n))
    {
        cond = new PropertyCondition(AutomationElement.NameProperty, n.GetString());
    }
    else if (root.TryGetProperty("automationId", out JsonElement a))
    {
        cond = new PropertyCondition(AutomationElement.AutomationIdProperty, a.GetString());
    }
    else
    {
        throw new ArgumentException("selector requires 'name' or 'automationId'");
    }

    return win.FindFirst(TreeScope.Descendants, cond)
        ?? throw new InvalidOperationException("element not found");
}

static string Handle(JsonElement root)
{
    string? cmd = root.GetProperty("cmd").GetString();
    switch (cmd)
    {
        case "ping":
            return Ok("\"pong\"");

        case "snapshot":
            return Snapshot(root);

        case "invoke":
        {
            AutomationElement el = Find(root);
            ((InvokePattern)el.GetCurrentPattern(InvokePattern.Pattern)).Invoke();
            return Ok("true");
        }

        case "select":
        {
            AutomationElement el = Find(root);
            ((SelectionItemPattern)el.GetCurrentPattern(SelectionItemPattern.Pattern)).Select();
            return Ok("true");
        }

        case "activate":
        {
            // Generic "primary action": try the patterns a control might expose,
            // in order. Lets callers click/select/toggle without knowing the type.
            AutomationElement el = Find(root);
            return Ok(JsonSerializer.Serialize(Activate(el)));
        }

        case "getValue":
        {
            AutomationElement el = Find(root);
            var vp = (ValuePattern)el.GetCurrentPattern(ValuePattern.Pattern);
            return Ok(JsonSerializer.Serialize(vp.Current.Value));
        }

        case "setValue":
        {
            AutomationElement el = Find(root);
            var vp = (ValuePattern)el.GetCurrentPattern(ValuePattern.Pattern);
            vp.SetValue(root.GetProperty("value").GetString());
            return Ok("true");
        }

        case "toggle":
        {
            AutomationElement el = Find(root);
            var tp = (TogglePattern)el.GetCurrentPattern(TogglePattern.Pattern);
            tp.Toggle();
            return Ok(JsonSerializer.Serialize(tp.Current.ToggleState.ToString()));
        }

        default:
            throw new ArgumentException("unknown cmd: " + cmd);
    }
}

static string Activate(AutomationElement el)
{
    if (el.TryGetCurrentPattern(InvokePattern.Pattern, out object inv))
    {
        ((InvokePattern)inv).Invoke();
        return "invoke";
    }
    if (el.TryGetCurrentPattern(SelectionItemPattern.Pattern, out object sel))
    {
        ((SelectionItemPattern)sel).Select();
        return "select";
    }
    if (el.TryGetCurrentPattern(TogglePattern.Pattern, out object tog))
    {
        ((TogglePattern)tog).Toggle();
        return "toggle";
    }
    if (el.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out object exp))
    {
        var p = (ExpandCollapsePattern)exp;
        if (p.Current.ExpandCollapseState == ExpandCollapseState.Collapsed)
        {
            p.Expand();
        }
        else
        {
            p.Collapse();
        }
        return "expandCollapse";
    }
    throw new InvalidOperationException("element exposes no actionable pattern");
}

static string Snapshot(JsonElement root)
{
    AutomationElement win = Window(root);
    int max = root.TryGetProperty("max", out JsonElement m) ? m.GetInt32() : 200;
    TreeWalker walker = TreeWalker.ControlViewWalker;
    var items = new List<string>();
    var stack = new Stack<AutomationElement>();

    AutomationElement? first = walker.GetFirstChild(win);
    if (first is not null)
    {
        stack.Push(first);
    }

    while (stack.Count > 0 && items.Count < max)
    {
        AutomationElement cur = stack.Pop();
        try
        {
            AutomationElement.AutomationElementInformation info = cur.Current;
            System.Windows.Rect r = info.BoundingRectangle;
            items.Add("{"
                + "\"name\":" + JsonSerializer.Serialize(info.Name) + ","
                + "\"automationId\":" + JsonSerializer.Serialize(info.AutomationId) + ","
                + "\"controlType\":" + JsonSerializer.Serialize(info.LocalizedControlType) + ","
                + "\"enabled\":" + (info.IsEnabled ? "true" : "false") + ","
                + "\"x\":" + Num(r.X) + ",\"y\":" + Num(r.Y) + ",\"w\":" + Num(r.Width) + ",\"h\":" + Num(r.Height)
                + "}");

            AutomationElement? sib = walker.GetNextSibling(cur);
            if (sib is not null)
            {
                stack.Push(sib);
            }
            AutomationElement? child = walker.GetFirstChild(cur);
            if (child is not null)
            {
                stack.Push(child);
            }
        }
        catch (ElementNotAvailableException)
        {
            // Element vanished mid-walk (UI changed) — skip it.
        }
    }

    return Ok("[" + string.Join(",", items) + "]");
}

static string Num(double d) => double.IsFinite(d) ? ((int)d).ToString(CultureInfo.InvariantCulture) : "0";
