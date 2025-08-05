import { Autocomplete, Tooltip } from '@heroui/react'
import { AutocompleteItem, Button } from '@heroui/react'
import { cn } from '@heroui/react'
import { open } from '@tauri-apps/plugin-dialog'
import { readDir } from '@tauri-apps/plugin-fs'
import { platform } from '@tauri-apps/plugin-os'
import { ArrowDownUp, FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { isRemotePath } from '../../lib/fs'
import { listPath } from '../../lib/rclone/api'
import { useStore } from '../../lib/store'
import { lockWindows, unlockWindows } from '../../lib/window'

export default function PathFinder({
    sourcePath = '',
    setSourcePath,
    destPath = '',
    setDestPath,
    switchable = true,
    sourceOptions = {
        label: 'Source',
        folderPicker: true,
        placeholder: 'Enter a remote:/path or local path',
        remoteSuggestions: true,
        clearable: true,
    },
    destOptions = {
        label: 'Destination',
        folderPicker: true,
        placeholder: 'Enter a remote:/path or local path',
        remoteSuggestions: true,
        clearable: true,
    },
}: {
    sourcePath?: string
    setSourcePath: (path: string | undefined) => void
    destPath?: string
    setDestPath: (path: string | undefined) => void
    switchable?: boolean
    sourceOptions?: {
        label: string
        placeholder: string
        folderPicker: boolean
        remoteSuggestions: boolean
        clearable: boolean
    }
    destOptions?: {
        label: string
        placeholder: string
        folderPicker: boolean
        remoteSuggestions: boolean
        clearable: boolean
    }
}) {
    const remotes = useStore((state) => state.remotes)

    const [suggestions, setSuggestions] = useState<
        Record<
            'source' | 'dest',
            {
                IsDir: boolean
                Name: string
                Path: string
            }[]
        >
    >({
        source: [],
        dest: [],
    })

    const [isLoading, setIsLoading] = useState<{ source: boolean; dest: boolean }>({
        source: false,
        dest: false,
    })
    const [error, setError] = useState<{
        source: string | null
        dest: string | null
    }>({
        source: null,
        dest: null,
    })

    const handleSwap = () => {
        const temp = sourcePath
        setSourcePath(destPath)
        setDestPath(temp)
    }

    const handleBrowse = useCallback(
        async (field: 'source' | 'dest') => {
            try {
                await lockWindows()
                const selected = await open({
                    directory: true,
                    multiple: false,
                    defaultPath: field === 'source' ? sourcePath : destPath,
                })
                await unlockWindows()
                if (selected) {
                    if (field === 'source') {
                        setSourcePath(selected as string)
                    } else {
                        setDestPath(selected as string)
                    }
                }
            } catch (err) {
                console.error('Failed to open folder picker:', err)
                setError((prev) => ({
                    ...prev,
                    [field]: 'Failed to open folder picker',
                }))
            }
        },
        [destPath, sourcePath, setDestPath, setSourcePath]
    )

    const fetchSuggestions = useCallback(
        async (path: string, field: 'source' | 'dest') => {
            setIsLoading((prev) => ({ ...prev, [field]: true }))
            setError((prev) => ({ ...prev, [field]: null }))

            // console.log('fetching suggestions for', path, field)

            const slashSymbol = platform() === 'windows' ? '\\' : '/'

            try {
                // If path is empty, show list of remotes
                if (!path) {
                    const remoteItems = remotes.map((remote) => ({
                        IsDir: true,
                        Name: remote + ':/',
                        Path: remote + ':/',
                    }))
                    setSuggestions((prev) => ({ ...prev, [field]: remoteItems }))
                    return
                }

                // Fetch suggestions for local paths
                if (!isRemotePath(path)) {
                    let localEntries: Awaited<ReturnType<typeof readDir>> = []
                    let cleanedPath = path

                    try {
                        localEntries = await readDir(cleanedPath)
                    } catch (err) {
                        // most likely due to the path being a file
                        console.error('Failed to fetch local suggestions:', err)
                        try {
                            // we also retry in case the last part of the path is wrong
                            cleanedPath = path.split(slashSymbol).slice(0, -1).join(slashSymbol)
                            localEntries = await readDir(cleanedPath)
                        } catch (err) {
                            console.error('Failed to fetch local suggestions (again):', err)
                        }
                    }

                    const extraSlash = cleanedPath.endsWith(slashSymbol) ? '' : slashSymbol

                    const localSuggestions = localEntries
                        .filter((entry) => !entry.isSymlink)
                        .map((entry) => ({
                            IsDir: entry.isDirectory,
                            Name: entry.name,
                            Path: `${cleanedPath}${extraSlash}${entry.name}`,
                        }))

                    setSuggestions((prev) => ({ ...prev, [field]: localSuggestions }))

                    return
                }

                // Split the path into remote and path parts
                const [remote, ...pathParts] = path.split(':/')
                if (!remote) {
                    throw new Error('Invalid remote path format')
                }

                let remotePath = pathParts.join('/')
                if (remotePath.endsWith('/')) {
                    remotePath = remotePath.slice(0, -1)
                }

                const items = await listPath(remote, remotePath, {
                    noModTime: true,
                    noMimeType: true,
                })

                const suggestionsWithRemote = items.map((item) => ({
                    IsDir: item.IsDir,
                    Name: item.Path,
                    Path: `${remote}:/${item.Path}`,
                }))

                setSuggestions((prev) => ({ ...prev, [field]: suggestionsWithRemote }))
            } catch (err) {
                console.error('Failed to fetch suggestions:', err)
                const errorMessage =
                    err instanceof Error ? err.message : 'Failed to fetch suggestions'
                setError((prev) => ({
                    ...prev,
                    [field]: errorMessage,
                }))
                setSuggestions((prev) => ({ ...prev, [field]: [] }))
            } finally {
                setIsLoading((prev) => ({ ...prev, [field]: false }))
            }
        },
        [remotes]
    )

    const handlePathChange = useCallback(
        (value: string, field: 'source' | 'dest') => {
            if (field === 'source') {
                setSourcePath(value)
            } else {
                setDestPath(value)
            }
        },
        [setDestPath, setSourcePath]
    )

    useEffect(() => {
        fetchSuggestions(sourcePath, 'source')
    }, [sourcePath, fetchSuggestions])

    useEffect(() => {
        fetchSuggestions(destPath, 'dest')
    }, [destPath, fetchSuggestions])

    //! suggestions close because component re-renders
    const renderField = useCallback(
        (field: 'source' | 'dest') => {
            const isSource = field === 'source'

            const value = isSource ? sourcePath : destPath
            const setValue = (newValue: string) => handlePathChange(newValue, field)
            const isFieldLoading = isLoading[field]
            const fieldError = error[field]

            const remoteSuggestionsEnabled = isSource
                ? sourceOptions.remoteSuggestions
                : destOptions.remoteSuggestions

            const fieldSuggestions = remoteSuggestionsEnabled ? suggestions[field] : []

            const pickerEnabled = isSource ? sourceOptions.folderPicker : destOptions.folderPicker

            const isClearable = isSource ? sourceOptions.clearable : destOptions.clearable

            return (
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Autocomplete
                            size="lg"
                            label={isSource ? sourceOptions.label : destOptions.label}
                            allowsCustomValue={true}
                            inputValue={value}
                            onInputChange={(e) => setValue(e)}
                            onFocus={() => {
                                if (!value) {
                                    fetchSuggestions('', field)
                                }
                            }}
                            shouldCloseOnBlur={false}
                            placeholder={
                                isSource ? sourceOptions.placeholder : destOptions.placeholder
                            }
                            isInvalid={!!fieldError}
                            errorMessage={fieldError}
                            isLoading={isFieldLoading}
                            selectorIcon={remoteSuggestionsEnabled ? undefined : null}
                            isClearable={isClearable}
                        >
                            {fieldSuggestions.map((item, index) => (
                                <AutocompleteItem
                                    startContent={item.IsDir ? '📁' : '📄'}
                                    key={index}
                                    textValue={item.Path}
                                    title={item.Name}
                                />
                            ))}
                        </Autocomplete>
                    </div>
                    {pickerEnabled && (
                        <Button
                            onPress={() => handleBrowse(field)}
                            type="button"
                            isIconOnly={true}
                            size="lg"
                            className="w-16 h-18"
                            data-focus-visible="false"
                        >
                            <FolderOpen className="w-6 h-6" />
                        </Button>
                    )}
                </div>
            )
        },
        [
            sourcePath,
            destPath,
            suggestions,
            isLoading,
            error,
            fetchSuggestions,
            handleBrowse,
            handlePathChange,
            sourceOptions,
            destOptions,
        ]
    )

    return (
        <div className="flex flex-col gap-8">
            {renderField('source')}

            {switchable && (
                <div className="flex justify-center">
                    <Button
                        onPress={handleSwap}
                        type="button"
                        isIconOnly={true}
                        size="lg"
                        isDisabled={!sourcePath && !destPath}
                        data-focus-visible="false"
                    >
                        <ArrowDownUp className="w-6 h-6" />
                    </Button>
                </div>
            )}

            {renderField('dest')}
        </div>
    )
}
