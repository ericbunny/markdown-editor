//! 图标素材的结构校验。
//!
//! 窗口（标题栏）与任务栏图标由 Tauri 在编译期取自 `icons/icon.ico`——`tauri.conf.json`
//! 的 `bundle.icon` 决定取用哪份素材，`tauri-build` 又把同一个文件嵌进可执行文件资源，
//! 因此资源管理器、任务栏固定项和运行时的窗口图标是同一张图。
//!
//! 素材由 `tools/make_icon.ps1` 生成；这里只做结构断言，保证重新生成后不会漏档或写坏。

#[cfg(test)]
mod tests {
    const ICO: &[u8] = include_bytes!("../icons/icon.ico");
    const ICNS: &[u8] = include_bytes!("../icons/icon.icns");

    fn png_size(bytes: &[u8]) -> (u32, u32) {
        assert_eq!(&bytes[..8], b"\x89PNG\r\n\x1a\n", "不是合法的 PNG");
        (
            u32::from_be_bytes(bytes[16..20].try_into().unwrap()),
            u32::from_be_bytes(bytes[20..24].try_into().unwrap()),
        )
    }

    #[test]
    fn window_icon_covers_the_sizes_windows_shell_expects() {
        assert_eq!(u16::from_le_bytes([ICO[0], ICO[1]]), 0);
        assert_eq!(u16::from_le_bytes([ICO[2], ICO[3]]), 1);
        let count = u16::from_le_bytes([ICO[4], ICO[5]]) as usize;
        assert_eq!(count, 7, "icon.ico 应包含 7 个尺寸");
        let sizes: Vec<u8> = (0..count).map(|index| ICO[6 + index * 16]).collect();
        assert_eq!(
            sizes,
            vec![32, 16, 24, 48, 64, 128, 0],
            "首条目是运行时窗口图标，必须是 32×32；0 表示 256×256 条目"
        );
        for index in 0..count {
            let entry = 6 + index * 16;
            let len = u32::from_le_bytes(ICO[entry + 8..entry + 12].try_into().unwrap()) as usize;
            let offset =
                u32::from_le_bytes(ICO[entry + 12..entry + 16].try_into().unwrap()) as usize;
            assert!(offset + len <= ICO.len(), "第 {index} 个图标条目的数据越界");
        }
        let png_entry = 6 + (count - 1) * 16;
        let offset =
            u32::from_le_bytes(ICO[png_entry + 12..png_entry + 16].try_into().unwrap()) as usize;
        assert_eq!(
            png_size(&ICO[offset..]),
            (256, 256),
            "256 档应是 256×256 的 PNG"
        );
    }

    #[test]
    fn bundle_icons_keep_their_declared_dimensions() {
        assert_eq!(png_size(include_bytes!("../icons/icon.png")), (512, 512));
        assert_eq!(png_size(include_bytes!("../icons/32x32.png")), (32, 32));
        assert_eq!(png_size(include_bytes!("../icons/128x128.png")), (128, 128));
        assert_eq!(
            png_size(include_bytes!("../icons/128x128@2x.png")),
            (256, 256)
        );
    }

    #[test]
    fn icns_container_is_well_formed() {
        assert_eq!(&ICNS[..4], b"icns");
        let total = u32::from_be_bytes(ICNS[4..8].try_into().unwrap()) as usize;
        assert_eq!(total, ICNS.len(), "icns 头部长度应与文件长度一致");

        let expected_types = [
            "ic11", "ic12", "ic07", "ic13", "ic08", "ic14", "ic09", "ic10",
        ];
        let expected_sizes = [32u32, 64, 128, 256, 256, 512, 512, 1024];
        let mut cursor = 8;
        for (index, kind) in expected_types.iter().enumerate() {
            assert!(cursor + 8 <= total, "icns 条目数少于预期");
            assert_eq!(
                String::from_utf8_lossy(&ICNS[cursor..cursor + 4]),
                *kind,
                "第 {index} 个 icns 条目类型不符"
            );
            let len = u32::from_be_bytes(ICNS[cursor + 4..cursor + 8].try_into().unwrap()) as usize;
            assert!(len >= 8 && cursor + len <= total, "第 {index} 个条目越界");
            let size = expected_sizes[index];
            assert_eq!(
                png_size(&ICNS[cursor + 8..cursor + len]),
                (size, size),
                "第 {index} 个条目应是 {size}×{size} 的 PNG"
            );
            cursor += len;
        }
        assert_eq!(cursor, total, "icns 条目应恰好铺满整个文件");
    }
}
