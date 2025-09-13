import { Button, Input, Select, SelectItem } from '@heroui/react'
import cronstrue from 'cronstrue'
import { ClockIcon, XIcon } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'

interface CronEditorProps {
    expression: string | null
    onChange: (newExpression: string | null) => void
}

interface CronFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    options: string[]
}

const DEFAULT_OPTIONS = ['*', '*/5', '*/10', '*/15', '*/30']

export default function CronEditor({ expression, onChange }: CronEditorProps) {
    const [cronExpression, setCronExpression] = useState(expression)

    const [minute, hour, dayOfMonth, month, dayOfWeek] = (cronExpression || '* * * * *').split(' ')

    const readableDescription = (() => {
        if (!cronExpression) return 'This task is not scheduled'
        let description: string
        try {
            description = cronstrue.toString(cronExpression)
            description +=
                '. Jobs trigger when the UI is running, if the active config is the same.'
        } catch {
            description = 'Invalid cron expression'
        }
        return description
    })()

    function handleFieldChange(field: string, value: string) {
        const parts = (cronExpression || '* * * * *').split(' ')
        const index = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'].indexOf(field)
        if (index !== -1) {
            parts[index] = value
            setCronExpression(parts.join(' '))
        }
    }

    useEffect(() => {
        onChange(cronExpression)
    }, [cronExpression, onChange])

    return (
        <div className="flex flex-col w-full gap-2">
            <Input
                value={cronExpression || ''}
                onChange={(e) => {
                    const expression = e.target.value

                    if (expression.length > 0) {
                        setCronExpression(expression)
                    } else {
                        setCronExpression(null)
                    }
                }}
                placeholder="Enter cron expression (e.g. 0 0 * * *)"
                size="lg"
                startContent={<ClockIcon className="text-default-400" />}
                isClearable={true}
                onClear={() => setCronExpression(null)}
            />

            <div className="grid grid-cols-5 gap-2">
                <CronField
                    label="Minute"
                    value={minute}
                    onChange={(v) => handleFieldChange('minute', v)}
                    options={generateOptions(0, 59)}
                />
                <CronField
                    label="Hour"
                    value={hour}
                    onChange={(v) => handleFieldChange('hour', v)}
                    options={generateOptions(0, 23)}
                />
                <CronField
                    label="Day (Month)"
                    value={dayOfMonth}
                    onChange={(v) => handleFieldChange('dayOfMonth', v)}
                    options={generateOptions(1, 31)}
                />
                <CronField
                    label="Month"
                    value={month}
                    onChange={(v) => handleFieldChange('month', v)}
                    options={generateOptions(1, 12)}
                />
                <CronField
                    label="Day (Week)"
                    value={dayOfWeek}
                    onChange={(v) => handleFieldChange('dayOfWeek', v)}
                    options={generateOptions(0, 7)}
                />
            </div>

            <div className="text-sm text-neutral-500">{readableDescription}</div>
        </div>
    )
}

function CronField({ label, value, onChange, options }: CronFieldProps) {
    const [isCustom, setIsCustom] = useState(false)

    useEffect(() => {
        const isCustom =
            !DEFAULT_OPTIONS.includes(value) &&
            !options.includes(value) &&
            value !== '*' &&
            value !== 'custom'
        setIsCustom(isCustom)
    }, [value, options])

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value)
    }

    return (
        <div>
            {isCustom ? (
                <Input
                    label={label}
                    value={value}
                    onChange={handleCustomChange}
                    className="max-w-xs"
                    endContent={
                        <Button
                            isIconOnly={true}
                            size="sm"
                            variant="light"
                            onPress={() => setIsCustom(false)}
                        >
                            <XIcon className="w-4 h-4 text-default-400" />
                        </Button>
                    }
                />
            ) : (
                <Select
                    label={label}
                    selectedKeys={[value]}
                    onSelectionChange={(key) => {
                        const item = key.currentKey
                        if (!item) return
                        if (item === 'custom') {
                            setIsCustom(true)
                        } else {
                            onChange(item)
                        }
                    }}
                    className="max-w-xs"
                    items={[
                        ...DEFAULT_OPTIONS.map((option) => ({ key: option, label: option })),
                        ...options.map((option) => ({ key: option, label: option })),
                        { key: 'custom', label: 'Custom' },
                    ]}
                >
                    {(item) => (
                        <SelectItem key={item.key} title={item.label}>
                            {item.key}
                        </SelectItem>
                    )}
                </Select>
            )}
        </div>
    )
}

function generateOptions(start: number, end: number): string[] {
    return Array.from({ length: end - start + 1 }, (_, i) => (start + i).toString())
}
