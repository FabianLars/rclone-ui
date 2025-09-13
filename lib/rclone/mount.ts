import { downloadDir } from '@tauri-apps/api/path'
import { ask } from '@tauri-apps/plugin-dialog'
import { exists, writeFile } from '@tauri-apps/plugin-fs'
import { fetch } from '@tauri-apps/plugin-http'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { platform } from '@tauri-apps/plugin-os'
import { Command } from '@tauri-apps/plugin-shell'

export async function needsMountPlugin() {
    console.log('[needsMountPlugin]')

    const currentPlatform = platform()
    if (currentPlatform === 'macos') {
        // check fuse-t or osxfuse
        const hasFuseT = await exists('/Library/Application Support/fuse-t')
        console.log('[needsMountPlugin] hasFuseT', hasFuseT)
        const hasOsxFuse = await exists('/Library/Filesystems/macfuse.fs')
        console.log('[needsMountPlugin] hasOsxFuse', hasOsxFuse)
        return !hasFuseT && !hasOsxFuse
    }
    if (currentPlatform === 'windows') {
        // check winfsp
        const hasWinFsp =
            (await exists('C:\\Program Files\\WinFsp')) ||
            (await exists('C:\\Program Files (x86)\\WinFsp'))
        console.log('[needsMountPlugin] hasWinFsp', hasWinFsp)
        return !hasWinFsp
    }
    return false
}

export async function dialogGetMountPlugin() {
    console.log('[dialogGetMountPlugin]')

    const currentPlatform = platform()
    if (currentPlatform === 'macos') {
        // download fuse-t or osxfuse
        const wantsDownload = await ask(
            "Fuse-t is required on macOS to mount remotes. You can continue the operation once you're done with the installation.",
            {
                title: 'Fuse-t not installed',
                kind: 'warning',
                okLabel: 'Download',
                cancelLabel: 'Cancel',
            }
        )
        if (wantsDownload) {
            const fuseInstallerUrl =
                'https://github.com/macos-fuse-t/fuse-t/releases/download/1.0.49/fuse-t-macos-installer-1.0.49.pkg'
            const localPath = `${await downloadDir()}/fuse-t-installer.pkg`
            const installer = await (await fetch(fuseInstallerUrl)).arrayBuffer()
            await writeFile(localPath, new Uint8Array(installer))
            await revealItemInDir(localPath)
        }
    }
    if (currentPlatform === 'windows') {
        // download winfsp
        const wantsDownload = await ask(
            "WinFsp is required on Windows to mount remotes. You can continue the operation once you're done with the installation.",
            {
                title: 'WinFsp not installed',
                kind: 'warning',
                okLabel: 'Download',
                cancelLabel: 'Cancel',
            }
        )
        if (wantsDownload) {
            const winFspInstallerUrl =
                'https://github.com/winfsp/winfsp/releases/download/v2.0/winfsp-2.0.23075.msi'
            const localPath = `${await downloadDir()}/winfsp-installer.msi`
            const installer = await (await fetch(winFspInstallerUrl)).arrayBuffer()
            await writeFile(localPath, new Uint8Array(installer))
            await revealItemInDir(localPath)
        }
    }
}

export async function unmount(mountPoint: string, force = false) {
    console.log('[unmount]', mountPoint, force)

    const command = Command.create('umount', [force ? '-f' : '', mountPoint])

    const output = await command.execute()

    if (output.code !== 0) {
        if (output.stderr.toLowerCase().includes('busy')) {
            const answer = await ask('This resource is busy, do you wish to force unmount?', {
                title: 'Could not unmount',
                kind: 'warning',
                okLabel: 'Force Unmount',
                cancelLabel: 'Cancel',
            })
            if (answer) {
                return await unmount(mountPoint, true)
            }
            throw new Error(output.stderr)
        }

        if (output.stderr.toLowerCase().includes('not currently mounted')) {
            console.error('[unmount] not currently mounted')
            return
        }

        console.error('[unmount] failed to unmount', output.stderr)
        throw new Error(output.stderr)
    }

    return
}
