
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "./input"
import { Label } from "./label"

interface DateTimePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    label: string;
}

export function DateTimePicker({ date, setDate, label }: DateTimePickerProps) {
  const [time, setTime] = React.useState(date ? format(date, "HH:mm") : "00:00");
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
        setDate(undefined);
        return;
    }
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(selectedDate);
    newDate.setHours(hours, minutes);
    setDate(newDate);
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    if (!date) return;
    
    const [hours, minutes] = newTime.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes);
    setDate(newDate);
  }

  if (!isClient) {
    return null;
  }

  return (
    <div className="grid gap-1">
        <Label htmlFor={`date-time-picker-${label.toLowerCase()}`} className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id={`date-time-picker-${label.toLowerCase()}`}
                    variant={"outline"}
                    className={cn(
                    "w-[200px] justify-start text-left font-normal h-8",
                    !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "LLL dd, y") : <span>Pick a date</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
             <Input
                type="time"
                value={time}
                onChange={handleTimeChange}
                className="h-8 w-[100px]"
            />
        </div>
    </div>
  )
}
