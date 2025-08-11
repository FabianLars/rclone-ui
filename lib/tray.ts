import { Menu } from '@tauri-apps/api/menu'
import { MenuItem } from '@tauri-apps/api/menu'
import { resolveResource } from '@tauri-apps/api/path'
import type { TrayIconEvent } from '@tauri-apps/api/tray'
import { TrayIcon } from '@tauri-apps/api/tray'
import { getAllWindows, getCurrentWindow } from '@tauri-apps/api/window'
import { ask } from '@tauri-apps/plugin-dialog'
import { platform } from '@tauri-apps/plugin-os'
import { exit } from '@tauri-apps/plugin-process'
import { buildMenu } from './menu'
import { resetMainWindow } from './window'

export async function getMainTray() {
    return await TrayIcon.getById('main-tray')
}

export async function getLoadingTray() {
    return await TrayIcon.getById('loading-tray')
}

export async function triggerTrayRebuild() {
    return getAllWindows().then((windows) => {
        windows.find((w) => w.label === 'main')?.emit('rebuild-tray')
    })
}

export async function rebuildTrayMenu() {
    console.log('[rebuildTrayMenu]')

    const tray = await getMainTray()
    if (!tray) {
        console.error('[rebuildTrayMenu] tray not found')
        return
    }
    const newMenu = await buildMenu()
    await tray.setMenu(newMenu)

    console.log('[rebuildTrayMenu] tray menu rebuilt')
}

async function onTrayAction(event: TrayIconEvent) {
    if (event.type === 'Click') {
        console.log('[onTrayAction] tray clicked:', event)

        await resetMainWindow()
    }
}

// Initialize the tray
export async function initTray(): Promise<void> {
    try {
        console.log('[initTray]')
        const menu = await buildMenu()
        console.log('[initTray] built menu')

        await TrayIcon.getById('loading-tray').then((t) => t?.setVisible(false))
        console.log('[initTray] set loading tray to false')

        await TrayIcon.new({
            id: 'main-tray',
            icon: (await resolveResource('icons/favicon/icon.png'))!,
            tooltip: 'Rclone',
            menu,
            menuOnLeftClick: true,
            action: onTrayAction,
        })
    } catch (error) {
        console.error('[initTray] failed to create tray')
        console.error(error)
    }
}

export async function initLoadingTray() {
    console.log('[initLoadingTray]')

    if (platform() === 'linux') {
        console.log('[initLoadingTray] platform is linux, skipping')
        return
    }

    const globeIconPath = await resolveResource('icons/favicon/frame_00_delay-0.1s.png')

    const quitItem = await MenuItem.new({
        id: 'quit-loading',
        text: 'Quit',
        action: async () => {
            const answer = await ask('An operation is in progress, are you sure you want to exit?')
            if (answer) {
                await getCurrentWindow().emit('close-app')
                await exit(0)
            }
        },
    })

    const loadingMenu = await Menu.new({
        id: 'main-menu',
        items: [quitItem],
    })

    const loadingTray = await TrayIcon.new({
        id: 'loading-tray',
        icon: globeIconPath,
        menu: loadingMenu,
    })

    let currentIcon = 1

    setInterval(async () => {
        if (currentIcon > 17) {
            currentIcon = 1
        }
        const globeIconPath = await resolveResource(
            `icons/favicon/frame_${currentIcon < 10 ? '0' : ''}${currentIcon}_delay-0.1s.png`
        )
        await loadingTray?.setIcon(globeIconPath)
        currentIcon += 1
    }, 200)
}
