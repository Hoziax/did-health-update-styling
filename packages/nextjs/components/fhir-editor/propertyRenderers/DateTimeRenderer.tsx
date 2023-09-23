import React, { useState } from "react";
import TextField from "@mui/material/TextField";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

type DateTimePickerProps = {
  value?: string;
  updateValue: (val: string) => void;
};

export default function DateTimePicker({ value, updateValue }: DateTimePickerProps) {
  const handleDateChange = (newDate: any) => {
    const dateStr = newDate.toJSON();
    console.log(newDate, dateStr);
    updateValue(dateStr);
  };

  return (
    <DatePicker
      value={value}
      onChange={handleDateChange}
      renderInput={(params: any) => <TextField size="small" {...params} />}
    />
  );
}
