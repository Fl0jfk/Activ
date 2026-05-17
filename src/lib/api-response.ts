import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export function jsonOk<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}
