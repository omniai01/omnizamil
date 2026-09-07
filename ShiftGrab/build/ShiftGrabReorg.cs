using System;
using System.Diagnostics;
using System.IO;

class ShiftGrabReorg {
  static int Main(string[] args) {
    try {
      if (args.Length < 1) return 2;
      string root = args[0];
      string engine = Path.Combine(root, ".shiftgrab-engine");
      Directory.CreateDirectory(engine);

      string[] entries = Directory.GetFileSystemEntries(root);
      for (int i = 0; i < entries.Length; i++) {
        string entry = entries[i];
        string name = Path.GetFileName(entry);
        if (string.Equals(name, ".shiftgrab-engine", StringComparison.OrdinalIgnoreCase)) continue;
        if (string.Equals(name, "README.md", StringComparison.OrdinalIgnoreCase)) continue;
        if (name.StartsWith("Uninstall", StringComparison.OrdinalIgnoreCase)) continue;
        if (string.Equals(name, "ShiftGrabLauncher.exe", StringComparison.OrdinalIgnoreCase)) continue;
        if (string.Equals(name, "ShiftGrabReorg.exe", StringComparison.OrdinalIgnoreCase)) continue;

        string dest = Path.Combine(engine, name);
        if (Directory.Exists(entry)) {
          if (Directory.Exists(dest)) Directory.Delete(dest, true);
          Directory.Move(entry, dest);
        } else if (File.Exists(entry)) {
          if (File.Exists(dest)) File.Delete(dest);
          File.Move(entry, dest);
        }
      }

      string readme =
        "# ShiftGrab\r\n\r\n" +
        "On-device YouTube & social downloader by ShiftZero.\r\n\r\n" +
        "## Use\r\n" +
        "1. Open ShiftGrab from the Desktop or Start Menu.\r\n" +
        "2. Paste a link and download.\r\n\r\n" +
        "Website: https://shiftzero.netlify.app\r\n\r\n" +
        "Uninstall anytime from Windows Apps.\r\n";
      File.WriteAllText(Path.Combine(root, "README.md"), readme);

      string stub = Path.Combine(root, "ShiftGrabLauncher.exe");
      string main = Path.Combine(root, "ShiftGrab.exe");
      if (File.Exists(stub)) {
        if (File.Exists(main)) File.Delete(main);
        File.Move(stub, main);
      }

      try {
        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = "attrib.exe";
        psi.Arguments = "+H +S \"" + engine + "\"";
        psi.CreateNoWindow = true;
        psi.UseShellExecute = false;
        Process p = Process.Start(psi);
        if (p != null) p.WaitForExit(5000);
      } catch {
      }

      try {
        string[] leftovers = Directory.GetFiles(root, "uninstallerIcon*");
        for (int i = 0; i < leftovers.Length; i++) {
          try { File.Delete(leftovers[i]); } catch { }
        }
      } catch {
      }
      return 0;
    } catch {
      return 1;
    }
  }
}
