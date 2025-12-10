
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a Date object or a date string into a MySQL-compatible DATETIME string in UTC.
 * Example: '2024-07-26 15:30:00'
 * @param date The Date object or date string to format.
 * @returns A string formatted for MySQL DATETIME columns, in UTC.
 */
export function formatDateForMySQL(date: Date | string): string {
  console.log("--- formatDateForMySQL ---");
  console.log("1. Initial input received:", date);

  // Create a new Date object from the input to handle both strings and Date objects.
  // This standardizes the input before processing.
  const d = new Date(date);
  console.log("2. Date object created:", d.toISOString());


  // Check if the date is valid. If new Date() is called with an invalid string, it returns an Invalid Date object.
  if (isNaN(d.getTime())) {
    console.error("❌ Invalid date provided to formatDateForMySQL:", date);
    throw new Error(`Invalid date provided to formatDateForMySQL: ${date}`);
  }

  // Get individual UTC date components
  const year = d.getUTCFullYear();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0'); // months are 0-indexed
  const day = d.getUTCDate().toString().padStart(2, '0');
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  const seconds = d.getUTCSeconds().toString().padStart(2, '0');

  console.log(`3. UTC Components: Y=${year}, M=${month}, D=${day}, h=${hours}, m=${minutes}, s=${seconds}`);

  const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  console.log("4. Final formatted UTC string:", formattedDate);
  console.log("--------------------------");

  return formattedDate;
}
