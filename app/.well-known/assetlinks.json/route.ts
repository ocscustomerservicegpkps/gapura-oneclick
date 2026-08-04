
import { NextResponse } from "next/server";

export async function GET() {
  const data = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.gapura.oneclick.twa",
        sha256_cert_fingerprints: [
          "11:01:AA:07:54:E7:36:42:63:13:BE:D2:34:23:4F:C3:2D:BF:0C:22:24:E7:6F:D9:46:80:90:8A:8F:C3:20:EE",
        ],
      },
    },
  ];

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
