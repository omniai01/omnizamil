using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

class ShiftGrabLauncher {
  [STAThread]
  static void Main() {
    try {
      string root = AppDomain.CurrentDomain.BaseDirectory;
      string engine = Path.Combine(root, ".shiftgrab-engine");
      string target = Path.Combine(engine, "ShiftGrab.exe");
      if (!File.Exists(target)) {
        MessageBox.Show("ShiftGrab engine is missing. Please reinstall ShiftGrab.", "ShiftGrab");
        return;
      }
      ProcessStartInfo psi = new ProcessStartInfo();
      psi.FileName = target;
      psi.WorkingDirectory = engine;
      psi.UseShellExecute = true;
      Process.Start(psi);
    } catch (Exception ex) {
      MessageBox.Show(ex.Message, "ShiftGrab");
    }
  }
}
