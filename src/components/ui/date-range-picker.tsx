
"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { enUS } from 'date-fns/locale';
import { type DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import DatePicker from "react-datepicker";



interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}

export function DateRangePicker({
  className,
  date: externalDate,
  setDate: setExternalDate,
}: DateRangePickerProps) {
  
  const [localDate, setLocalDate] = React.useState<DateRange | undefined>(externalDate);

  const toUTCDate = (date: Date): Date => {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  }

  const handleFromChange = (newFromDate: Date | null) => {
    if (!newFromDate) return;
    const utcFrom = toUTCDate(newFromDate);
    const newRange = { from: utcFrom, to: localDate?.to };
    setLocalDate(newRange);
    if (newRange.from && newRange.to) {
        setExternalDate(newRange);
    }
  }
  
  const handleToChange = (newToDate: Date | null) => {
     if (!newToDate) return;
    const utcTo = toUTCDate(newToDate);
    const newRange = { from: localDate?.from, to: utcTo };
    setLocalDate(newRange);
     if (newRange.from && newRange.to) {
        setExternalDate(newRange);
    }
  }

  const formatDateForDisplay = (date: Date) => {
    // Adjust for timezone offset to display the correct GMT date
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
    return format(adjustedDate, "LLL dd, y", { locale: enUS });
  };

  return (
    <div className={cn("flex flex-col", className)}>
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id="date-from"
                    variant={"outline"}
                    className={cn(
                    "w-full justify-start text-left font-normal h-8 text-xs",
                    !localDate?.from && "text-muted-foreground"
                    )}
                >
                    {/* <CalendarIcon className="mr-2 h-4 w-4" /> */}
                    {localDate?.from ? formatDateForDisplay(localDate.from) : <span>Start date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
               <DatePicker 
                selected={localDate?.from}
                onChange={handleFromChange}
                selectsStart
                startDate={localDate?.from}
                endDate={localDate?.to}
                dateFormat="MMM dd, yyyy"
                inline
                />
            </PopoverContent>
        </Popover>
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id="date-to"
                    variant={"outline"}
                    className={cn(
                    "w-full justify-start text-left font-normal h-8 text-xs",
                    !localDate?.to && "text-muted-foreground"
                    )}
                >
                    {/* <CalendarIcon className="mr-2 h-4 w-4" /> */}
                    {localDate?.to ? formatDateForDisplay(localDate.to) : <span>End date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <DatePicker 
                selected={localDate?.to}
                onChange={handleToChange}
                selectsEnd
                startDate={localDate?.from}
                endDate={localDate?.to}
                minDate={localDate?.from}
                dateFormat="MMM dd, yyyy"
                inline
                />
            </PopoverContent>
        </Popover>
    </div>
  )
}
