import Image from 'next/image';
import type { SVGProps } from 'react';
import LogoImage from "./../../../public/logo/ComfortPayLogo.png";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    // <svg
    //   xmlns="http://www.w3.org/2000/svg"
    //   viewBox="0 0 200 50"
    //   width="200"
    //   height="50"
    //   {...props}
    // >
    //   <text
    //     x="10"
    //     y="35"
    //     fontFamily="'Inter', sans-serif"
    //     fontSize="30"
    //     fontWeight="bold"
    //     fill="currentColor"
    //   >
    //     Comfort
    //     <tspan fill="hsl(var(--accent))">Pay</tspan>
    //   </text>
    // </svg>
    <div
    >
      <Image 
    src={LogoImage}
    alt='Comfortpay'
    width={150}
    height={50}
  
    style={{
      borderRadius: 10,
    }}
    />
    </div>
  );
}
