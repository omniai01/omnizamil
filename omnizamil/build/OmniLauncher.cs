using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

class OmniLauncher {
  [STAThread]
  static void Main() {
    try {
      string root = AppDomain.CurrentDomain.BaseDirectory;
      string engine = Path.Combine(root, ".omni-engine");
      string target = Path.Combine(engine, "Omni-Removal.exe");
      if (!File.Exists(target)) {
        MessageBox.Show("Omni engine is missing. Please reinstall Omni-Removal.", "Omni-Removal");
        return;
      }
      ProcessStartInfo psi = new ProcessStartInfo();
      psi.FileName = target;
      psi.WorkingDirectory = engine;
      psi.UseShellExecute = true;
      Process.Start(psi);
    } catch (Exception ex) {
      MessageBox.Show(ex.Message, "Omni-Removal");
    }
  }
}
