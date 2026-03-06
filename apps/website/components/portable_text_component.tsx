import Image from "next/image"
import { getImageDimensions } from '@sanity/asset-utils'
import { urlFor } from "@/sanity/sanity-utils"

export const PortableTextImageComponent = ({ value }: { value: any }) => {
    const imageUrl = urlFor(value) // Assuming urlFor
    const { width, height } = getImageDimensions(value)
  
    return (
      <div className="flex justify-center">
        <Image          
          src={imageUrl}
          alt={value.alt || ' '}
          loading="lazy"
          width={width}
          height={1}
          style={{
            aspectRatio: width / height,
          }}
          className="rounded-lg"
        />
      </div>
    )
  }
  