using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace XHBlogs
{
    public class TrayApp : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private ContextMenuStrip menu;
        private ToolStripMenuItem miStatus, miOpen, miSettings, miAutostart, miUptime;
        private Process nodeProcess;
        private string projectDir;
        private const int Port = 23525;
        private DateTime startTime;
        private System.Windows.Forms.Timer uptimeTimer;
        private bool isRunning;

        public TrayApp()
        {
            ResolvePaths();
            InitTray();
            uptimeTimer = new System.Windows.Forms.Timer { Interval = 60000 };
            uptimeTimer.Tick += (s, e) => UpdateUptime();
            uptimeTimer.Start();
        }

        private void ResolvePaths()
        {
            projectDir = Path.GetDirectoryName(Application.ExecutablePath);
            if (Directory.Exists(Path.Combine(projectDir, "launcher")))
                projectDir = Path.GetDirectoryName(projectDir);
            if (!File.Exists(Path.Combine(projectDir, "package.json")))
            {
                string guess = @"D:\mod\HaYenai\博客\XHBlogs";
                if (File.Exists(Path.Combine(guess, "package.json")))
                    projectDir = guess;
            }
        }

        private void InitTray()
        {
            menu = new ContextMenuStrip();

            miStatus = new ToolStripMenuItem("博客: 已停止") { Enabled = false };
            miOpen = new ToolStripMenuItem("🌐 浏览器打开");
            miOpen.Click += (s, e) => OpenBrowser();

            var miWindow = new ToolStripMenuItem("🪟 窗口模式打开");
            miWindow.Click += (s, e) => OpenBlogWindow();

            miSettings = new ToolStripMenuItem("🔧 设置面板");
            miSettings.Click += (s, e) => OpenSettings();

            miAutostart = new ToolStripMenuItem("开机自启: 关闭");
            miAutostart.Click += (s, e) => ToggleAutostart();
            UpdateAutostartLabel();

            miUptime = new ToolStripMenuItem("运行时长: --") { Enabled = false };
            var miExit = new ToolStripMenuItem("退出");
            miExit.Click += (s, e) => ExitApplication();

            menu.Items.Add(miStatus);
            menu.Items.Add(miOpen);
            menu.Items.Add(miWindow);
            menu.Items.Add(miSettings);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(miAutostart);
            menu.Items.Add(miUptime);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(miExit);

            trayIcon = new NotifyIcon
            {
                Text = "XHBlogs - 博客管理器 (:" + Port + ")",
                ContextMenuStrip = menu,
                Visible = true
            };

            string icoPath = Path.Combine(projectDir, "launcher", "tray.ico");
            if (!File.Exists(icoPath))
                icoPath = Path.Combine(projectDir, "launcher", "tray32.ico");
            if (File.Exists(icoPath))
            {
                try
                {
                    using (var fs = new FileStream(icoPath, FileMode.Open, FileAccess.Read))
                    {
                        trayIcon.Icon = new Icon(fs, new Size(32, 32));
                    }
                }
                catch
                {
                    trayIcon.Icon = SystemIcons.Application;
                }
            }
            else
            {
                trayIcon.Icon = SystemIcons.Application;
            }

            trayIcon.MouseClick += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    if (isRunning) OpenBlogWindow();
                    else StartServer();
                }
            };

            StartServer();
        }

        private void StartServer()
        {
            if (isRunning) return;
            try
            {
                // 启动博客 Next.js (使用 dev 模式 - 无需 npm run build, 启动即可用)
                var psi = new ProcessStartInfo
                {
                    FileName = "node",
                    Arguments = "node_modules/next/dist/bin/next dev -p " + Port,
                    WorkingDirectory = projectDir,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                };

                nodeProcess = new Process { StartInfo = psi, EnableRaisingEvents = true };
                nodeProcess.OutputDataReceived += (s, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        if (e.Data.Contains("Ready in") || e.Data.Contains("localhost:" + Port) || e.Data.Contains("Local:"))
                            OnServerReady();
                    }
                };
                nodeProcess.ErrorDataReceived += (s, e) => { };
                nodeProcess.Exited += (s, e) =>
                {
                    isRunning = false;
                    UpdateStatus("已停止");
                    nodeProcess = null;
                };

                nodeProcess.Start();
                nodeProcess.BeginOutputReadLine();
                nodeProcess.BeginErrorReadLine();
                startTime = DateTime.Now;
                UpdateStatus("启动中...");

                // dev 模式首次编译较慢, 兜底 90s 后强制认为就绪
                var timer = new System.Windows.Forms.Timer { Interval = 90000 };
                timer.Tick += (s2, e2) =>
                {
                    timer.Stop(); timer.Dispose();
                    if (nodeProcess != null && !nodeProcess.HasExited && !isRunning)
                        OnServerReady();
                };
                timer.Start();
            }
            catch (Exception ex)
            {
                UpdateStatus("启动失败");
                MessageBox.Show("启动博客失败:\n" + ex.Message + "\n\n请确认 Node.js 已安装。", "XHBlogs 错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void OnServerReady()
        {
            isRunning = true;
            UpdateStatus("运行中");
            trayIcon.Text = "XHBlogs - :" + Port;
        }

        private void StopServer()
        {
            if (nodeProcess != null && !nodeProcess.HasExited)
            {
                try { nodeProcess.Kill(); } catch { }
                nodeProcess.Dispose();
                nodeProcess = null;
            }
            isRunning = false;
            UpdateStatus("已停止");
        }

        private void OpenBrowser()
        {
            if (!isRunning) StartServer();
            try { Process.Start("http://localhost:" + Port); }
            catch { }
        }

        private void OpenBlogWindow()
        {
            if (!isRunning) StartServer();
            try
            {
                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                if (!File.Exists(edgePath))
                    edgePath = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
                if (File.Exists(edgePath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = edgePath,
                        Arguments = "--app=http://localhost:" + Port + " --app-size=1280,800 --no-first-run --no-default-browser-check",
                        UseShellExecute = false
                    });
                }
                else
                {
                    Process.Start("http://localhost:" + Port);
                }
            }
            catch { }
        }

        private void OpenSettings()
        {
            if (!isRunning) StartServer();
            try { Process.Start("http://localhost:" + Port + "/settings"); }
            catch { }
        }

        private void ToggleAutostart()
        {
            string startupPath = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
            string shortcutPath = Path.Combine(startupPath, "XHBlogs.lnk");
            if (File.Exists(shortcutPath))
            {
                File.Delete(shortcutPath);
            }
            else
            {
                try
                {
                    Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = Application.ExecutablePath;
                    shortcut.WorkingDirectory = projectDir;
                    shortcut.Description = "XHBlogs 博客管理";
                    shortcut.Save();
                }
                catch { }
            }
            UpdateAutostartLabel();
        }

        private void UpdateAutostartLabel()
        {
            string startupPath = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
            string shortcutPath = Path.Combine(startupPath, "XHBlogs.lnk");
            miAutostart.Text = File.Exists(shortcutPath) ? "开机自启: 已开启 ✅" : "开机自启: 关闭";
        }

        private void UpdateUptime()
        {
            if (isRunning)
            {
                TimeSpan e = DateTime.Now - startTime;
                if (e.TotalDays >= 1) miUptime.Text = "运行时长: " + (int)e.TotalDays + "天" + e.Hours + "时" + e.Minutes + "分";
                else if (e.TotalHours >= 1) miUptime.Text = "运行时长: " + (int)e.TotalHours + "时" + e.Minutes + "分";
                else miUptime.Text = "运行时长: " + (int)e.TotalMinutes + "分" + e.Seconds + "秒";
            }
            else miUptime.Text = "运行时长: --";
        }

        private void UpdateStatus(string status) { miStatus.Text = "博客: " + status; }

        private void ExitApplication()
        {
            StopServer();
            uptimeTimer.Stop();
            trayIcon.Visible = false;
            trayIcon.Dispose();
            Application.Exit();
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new TrayApp());
        }
    }
}
