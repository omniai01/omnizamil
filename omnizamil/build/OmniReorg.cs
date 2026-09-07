using System;
using System.Diagnostics;
using System.IO;

class OmniReorg {
  static int Main(string[] args) {
    try {
      if (args.Length < 1) return 2;
      string root = args[0];
      string engine = Path.Combine(root, ".omni-engine");
      Directory.CreateDirectory(engine);

      string[] entries = Directory.GetFileSystemEntries(root);
      for (int i = 0; i < entries.Length; i++) {
        string entry = entries[i];
        string name = Path.GetFileName(entry);
        if (string.Equals(name, ".omni-engine", StringComparison.OrdinalIgnoreCase)) continue;
        if (string.Equals(name, "README.md", StringComparison.OrdinalIgnoreCase)) continue;
        if (name.StartsWith("Uninstall", StringComparison.OrdinalIgnoreCase)) continue;
        if (string.Equals(name, "OmniLauncher.exe", StringComparison.OrdinalIgnoreCase)) continue;
        if (string.Equals(name, "OmniReorg.exe", StringComparison.OrdinalIgnoreCase)) continue;
        if (string.Equals(name, "reorg-install.ps1", StringComparison.OrdinalIgnoreCase)) continue;

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
        "# Omni-Removal\r\n\r\n" +
        "Official Omni-Removal for Windows.\r\n\r\n" +
        "## First-time setup\r\n" +
        "1. Open Omni-Removal and enter your name.\r\n" +
        "2. Go to **Settings → Omni setup**.\r\n" +
        "3. Click **Set up Omni** (one-time internet).\r\n" +
        "4. Wait until Image and Video show **Ready**, then restart if asked.\r\n" +
        "5. Image and video cleanup is ready.\r\n\r\n" +
        "## Support\r\n" +
        "- WhatsApp: open **Support** inside Omni-Removal (channel link is there).\r\n" +
        "- Or visit your Omni WhatsApp channel from Settings → Join our social.\r\n\r\n" +
        "Uninstall anytime from Windows Apps.\r\n";
      File.WriteAllText(Path.Combine(root, "README.md"), readme);

      string stub = Path.Combine(root, "OmniLauncher.exe");
      string main = Path.Combine(root, "Omni-Removal.exe");
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
