
"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { type DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Input } from "./input"

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}

export function DateRangePicker({
  className,
  date,
  setDate
}: DateRangePickerProps) {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const fromTime = date?.from ? format(date.from, "HH:mm") : "00:00";
  const toTime = date?.to ? format(date.to, "HH:mm") : "23:59";

  const handleDateSelect = (range: DateRange | undefined) => {
    if (!range) {
        setDate(undefined);
        return;
    }

    let { from, to } = range;

    if (from) {
        const [fromHours, fromMinutes] = fromTime.split(':').map(Number);
        from.setHours(fromHours, fromMinutes);
    }
    if (to) {
        const [toHours, toMinutes] = toTime.split(':').map(Number);
        to.setHours(toHours, toMinutes);
    }
    
    setDate({ from, to });
  };
  
  const handleTimeChange = (type: 'from' | 'to', time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    if (type === 'from' && date?.from) {
        const newFrom = new Date(date.from);
        newFrom.setHours(hours, minutes);
        setDate({ ...date, from: newFrom });
    }
    if (type === 'to' && date?.to) {
        const newTo = new Date(date.to);
        newTo.setHours(hours, minutes);
        setDate({ ...date, to: newTo });
    }
  };


  if (!isClient) {
    return null;
  }

  return (
    <div className={cn("grid gap-1", className)}>
      <Label htmlFor="date-range" className="text-xs">Filter by Date</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date-range"
            variant={"outline"}
            className={cn(
              "w-auto justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateSelect}
            numberOfMonths={2}
          />
           <div className="p-3 border-t grid grid-cols-2 gap-4">
              <div className="space-y-1">
                  <Label htmlFor="from-time" className="text-xs">Start Time</Label>
                  <Input 
                      id="from-time"
                      type="time" 
                      defaultValue={fromTime}
                      onChange={(e) => handleTimeChange('from', e.target.value)}
                      disabled={!date?.from}
                  />
              </div>
              <div className="space-y-1">
                  <Label htmlFor="to-time" className="text-xs">End Time</Label>
                   <Input 
                      id="to-time"
                      type="time" 
                      defaultValue={toTime}
                      onChange={(e) => handleTimeChange('to', e.target.value)}
                      disabled={!date?.to}
                  />
              </div>
           </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
