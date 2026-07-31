using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

// 从 PNG 生成多分辨率 ICO
// 用 .NET 内置 System.Drawing，避免外部依赖
class MakeIco
{
    static void Main(string[] args)
    {
        string inputPath = args.Length > 0 ? args[0] : "source-icon.png";
        string outputPath = args.Length > 1 ? args[1] : "tray.ico";

        if (!File.Exists(inputPath))
        {
            Console.WriteLine("ERROR: input not found: " + inputPath);
            Environment.Exit(1);
        }

        // 读取源 PNG
        Bitmap src;
        using (var fs = new FileStream(inputPath, FileMode.Open, FileAccess.Read))
        {
            src = (Bitmap)Image.FromStream(fs);
        }
        Console.WriteLine(string.Format("Source: {0}x{1}", src.Width, src.Height));

        // 生成多分辨率 ICO（图标在不同 DPI 下都能清晰显示）
        int[] sizes = new[] { 16, 24, 32, 48, 64, 128, 256 };
        Bitmap[] bitmaps = new Bitmap[sizes.Length];
        for (int i = 0; i < sizes.Length; i++)
        {
            bitmaps[i] = ResizeBitmap(src, sizes[i], sizes[i]);
        }

        // 写入 ICO 文件
        WriteIco(outputPath, bitmaps);

        // 清理
        foreach (var b in bitmaps) b.Dispose();
        src.Dispose();

        var fi = new FileInfo(outputPath);
        Console.WriteLine(string.Format("Wrote {0}: {1} bytes ({2} resolutions)", outputPath, fi.Length, sizes.Length));
    }

    static Bitmap ResizeBitmap(Bitmap src, int w, int h)
    {
        var dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        dst.SetResolution(src.HorizontalResolution, src.VerticalResolution);
        using (var g = Graphics.FromImage(dst))
        {
            g.Clear(Color.Transparent);
            g.CompositingMode = CompositingMode.SourceOver;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.DrawImage(src, 0, 0, w, h);
        }
        return dst;
    }

    static void WriteIco(string path, Bitmap[] bitmaps)
    {
        using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write))
        using (var bw = new BinaryWriter(fs))
        {
            // ICONDIR
            bw.Write((ushort)0); // reserved
            bw.Write((ushort)1); // type: 1=icon
            bw.Write((ushort)bitmaps.Length); // count

            // 计算 PNG / BMP 数据
            int headerSize = 6 + 16 * bitmaps.Length;
            long offset = headerSize;

            // ICONDIRENTRY 数组 + 数据
            byte[][] imageData = new byte[bitmaps.Length][];
            for (int i = 0; i < bitmaps.Length; i++)
            {
                int w = bitmaps[i].Width;
                int h = bitmaps[i].Height;
                // 0 表示 256
                bw.Write((byte)(w >= 256 ? 0 : w));
                bw.Write((byte)(h >= 256 ? 0 : h));
                bw.Write((byte)0); // colors in palette
                bw.Write((byte)0); // reserved
                bw.Write((ushort)1); // color planes
                bw.Write((ushort)32); // bits per pixel

                // 先占位 size/offset
                long sizePos = fs.Position;
                bw.Write((uint)0); // size
                bw.Write((uint)offset); // offset

                // 编码 PNG（PNG 格式 ICO 在 Windows Vista+ 支持）
                using (var ms = new MemoryStream())
                {
                    bitmaps[i].Save(ms, ImageFormat.Png);
                    imageData[i] = ms.ToArray();
                }
                uint size = (uint)imageData[i].Length;
                offset += size;

                // 回写 size
                long now = fs.Position;
                fs.Position = sizePos;
                bw.Write(size);
                fs.Position = now;
            }

            // 写入图像数据
            for (int i = 0; i < bitmaps.Length; i++)
            {
                bw.Write(imageData[i]);
            }
        }
    }
}