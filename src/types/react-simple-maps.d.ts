/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'react-simple-maps' {
  import { ComponentType, ReactNode, SVGProps } from 'react'

  export const ComposableMap: ComponentType<{
    projection?: string
    projectionConfig?: { scale?: number; center?: [number, number]; rotate?: [number, number, number] }
    width?: number; height?: number; style?: React.CSSProperties; children?: ReactNode
  }>

  export const Geographies: ComponentType<{
    geography: string | object
    children: (props: { geographies: any[] }) => ReactNode
  }>

  export const Geography: ComponentType<SVGProps<SVGPathElement> & {
    geography: any
    style?: { default?: any; hover?: any; pressed?: any }
    onMouseEnter?: (e: React.MouseEvent<SVGPathElement>) => void
    onMouseMove?:  (e: React.MouseEvent<SVGPathElement>) => void
    onMouseLeave?: (e: React.MouseEvent<SVGPathElement>) => void
    onClick?:      (e: React.MouseEvent<SVGPathElement>) => void
  }>

  export const Marker: ComponentType<{ coordinates: [number, number]; children?: ReactNode }>
}
