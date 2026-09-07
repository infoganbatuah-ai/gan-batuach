using System.Diagnostics;
using System.IO.Pipes;
using System.Security.Cryptography;
using System.ServiceProcess;
using System.Text;
using System.Text.RegularExpressions;

namespace DigitalObserverConnector;

internal static class Program
{
    internal const string ServiceName = "DigitalObserverConnector";
    internal const string SecretService = "com.digitalobserver.connector.commercial.v1";
    internal static readonly string Base = AppContext.BaseDirectory;
    internal static readonly string State = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Digital Observer");
    internal static readonly string SecretDir = Path.Combine(State, "Secrets");

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 4 && args[0] == "--secret") return Secret(args[1], args[2], args[3]);
        if (args.Length == 1 && args[0] == "--service") { ServiceBase.Run(new ConnectorService()); return 0; }
        ApplicationConfiguration.Initialize();
        if (args.Length == 1 && args[0].EndsWith(".observer-connect", StringComparison.OrdinalIgnoreCase))
            return SendInstallDocument(args[0]);
        Application.Run(new ConnectorWindow());
        return 0;
    }

    private static int Secret(string operation, string service, string account)
    {
        if (service != SecretService || !Regex.IsMatch(account, "^[a-z0-9_]{2,80}$")) return 65;
        Directory.CreateDirectory(SecretDir);
        var name = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(account))).ToLowerInvariant();
        var path = Path.Combine(SecretDir, name + ".secret");
        try
        {
            if (operation == "read") {
                if (!File.Exists(path)) return 44;
                var clear = ProtectedData.Unprotect(File.ReadAllBytes(path), Encoding.UTF8.GetBytes(SecretService), DataProtectionScope.LocalMachine);
                Console.OpenStandardOutput().Write(clear); CryptographicOperations.ZeroMemory(clear); return 0;
            }
            if (operation == "write") {
                using var input = Console.OpenStandardInput(); using var memory = new MemoryStream(); input.CopyTo(memory);
                if (memory.Length > 65536) return 65;
                var clear = memory.ToArray(); var encrypted = ProtectedData.Protect(clear, Encoding.UTF8.GetBytes(SecretService), DataProtectionScope.LocalMachine);
                CryptographicOperations.ZeroMemory(clear); File.WriteAllBytes(path, encrypted); return 0;
            }
            if (operation == "remove") { if (File.Exists(path)) File.Delete(path); return 0; }
            return 65;
        }
        catch { return 70; }
    }

    private static int SendInstallDocument(string path)
    {
        try {
            var bytes = File.ReadAllBytes(path); if (bytes.Length > 4096) return 65;
            using var pipe = new NamedPipeClientStream(".", ServiceName, PipeDirection.InOut, PipeOptions.None);
            pipe.Connect(5000); pipe.Write(BitConverter.GetBytes(bytes.Length)); pipe.Write(bytes); pipe.Flush(); pipe.WaitForPipeDrain();
            var result = pipe.ReadByte();
            MessageBox.Show(result == 0 ? "המחשב נמצא. חזרו לאשף ואשרו את החיבור לבית שלכם." : "הקישור לא הושלם. חזרו לאשף ונסו בקשה חדשה.", "Digital Observer");
            return result == 0 ? 0 : 70;
        } catch { MessageBox.Show("רכיב החיבור אינו פעיל. התקינו אותו מחדש ונסו שוב.", "Digital Observer"); return 70; }
    }
}

internal sealed class ConnectorWindow : Form
{
    public ConnectorWindow()
    {
        Text = "Digital Observer"; Width = 570; Height = 280; RightToLeft = RightToLeft.Yes; RightToLeftLayout = true;
        var title = new Label { Text = "Digital Observer — חיבור המצלמות", Dock = DockStyle.Top, Height = 58, Font = new Font(Font.FontFamily, 18, FontStyle.Bold), Padding = new Padding(18) };
        var message = new Label { Text = "רכיב החיבור מותקן ופועל ברקע. חזרו לאשף 'הוספת מצלמות' ופתחו את קובץ הקישור החד-פעמי.", Dock = DockStyle.Fill, Padding = new Padding(24), AutoSize = false };
        var dashboard = new Button { Text = "חזרה לתצפיתן", Dock = DockStyle.Bottom, Height = 48 };
        dashboard.Click += (_, _) => Process.Start(new ProcessStartInfo("https://ganbatuach.com/digital-observer/cameras/add") { UseShellExecute = true });
        Controls.Add(message); Controls.Add(dashboard); Controls.Add(title);
    }
}

internal sealed class ConnectorService : ServiceBase
{
    private CancellationTokenSource? stop;
    private Process? worker;
    public ConnectorService() { ServiceName = Program.ServiceName; CanStop = true; AutoLog = true; }
    protected override void OnStart(string[] args)
    {
        Directory.CreateDirectory(Program.State); stop = new CancellationTokenSource();
        _ = Task.Run(() => WorkerLoop(stop.Token)); _ = Task.Run(() => PairingLoop(stop.Token));
    }
    protected override void OnStop() { stop?.Cancel(); try { if (worker is { HasExited: false }) worker.Kill(true); } catch { } }

    private async Task WorkerLoop(CancellationToken token)
    {
        while (!token.IsCancellationRequested) {
            try { worker = StartNode("--service"); await worker.WaitForExitAsync(token); }
            catch (OperationCanceledException) { break; } catch { }
            try { await Task.Delay(TimeSpan.FromSeconds(30), token); } catch (OperationCanceledException) { break; }
        }
    }
    private async Task PairingLoop(CancellationToken token)
    {
        while (!token.IsCancellationRequested) {
            try {
                using var pipe = new NamedPipeServerStream(Program.ServiceName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
                await pipe.WaitForConnectionAsync(token);
                var sizeBytes = new byte[4]; await ReadExact(pipe, sizeBytes, token);
                var size = BitConverter.ToInt32(sizeBytes); if (size < 1 || size > 4096) throw new InvalidDataException();
                var document = new byte[size]; await ReadExact(pipe, document, token);
                var file = Path.Combine(Program.State, $"pairing-{Guid.NewGuid():N}.observer-connect");
                await File.WriteAllBytesAsync(file, document, token);
                int code; try { using var claim = StartNode("--document", file); await claim.WaitForExitAsync(token); code = claim.ExitCode; }
                finally { File.Delete(file); }
                pipe.WriteByte((byte)(code == 0 ? 0 : 1)); await pipe.FlushAsync(token);
            } catch (OperationCanceledException) { break; } catch { }
        }
    }
    private static async Task ReadExact(Stream stream, byte[] destination, CancellationToken token)
    {
        var offset = 0; while (offset < destination.Length) { var read = await stream.ReadAsync(destination.AsMemory(offset), token); if (read == 0) throw new EndOfStreamException(); offset += read; }
    }
    private static Process StartNode(params string[] operation)
    {
        var info = new ProcessStartInfo(Path.Combine(Program.Base, "bin", "node.exe")) { WorkingDirectory = Path.Combine(Program.Base, "runtime"), UseShellExecute = false, CreateNoWindow = true };
        info.ArgumentList.Add("scripts/connector-desktop-service.mjs"); foreach (var item in operation) info.ArgumentList.Add(item);
        info.Environment["NODE_ENV"] = "production"; info.Environment["OBSERVER_CONNECTOR_DATA_DIR"] = Program.State;
        info.Environment["OBSERVER_CONNECTOR_KEYCHAIN_SERVICE"] = Program.SecretService; info.Environment["OBSERVER_KEYCHAIN_HELPER"] = Environment.ProcessPath!;
        info.Environment["OBSERVER_EDGE_VERSION"] = "connector-desktop-v1"; info.Environment["OBSERVER_EDGE_BUILD_SHA"] = "windows-package";
        info.Environment["VIDEO_GATEWAY_PORT"] = "18084"; info.Environment["PATH"] = Path.Combine(Program.Base, "bin") + ";" + Environment.GetEnvironmentVariable("PATH");
        info.Environment["VIDEO_GATEWAY_OBJECT_MODEL_PATH"] = Path.Combine(Program.Base, "models", "ssd_mobilenet_v1_10.onnx");
        info.Environment["VIDEO_GATEWAY_OBJECT_WORKER_PATH"] = Path.Combine(Program.Base, "runtime", "services", "video-gateway", "onnx-object-worker.mjs");
        return Process.Start(info) ?? throw new InvalidOperationException();
    }
}
