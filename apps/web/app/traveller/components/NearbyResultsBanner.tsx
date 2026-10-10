interface NearbyResultsBannerProps {
  placeName: string;
}

export default function NearbyResultsBanner({ placeName }: NearbyResultsBannerProps) {
  return (
    <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
      <p className="font-semibold">No options in {placeName} right now</p>
      <p className="mt-1 text-sm">Here are the closest available options for you.</p>
    </div>
  );
}
