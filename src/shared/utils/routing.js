const calcStraightLineDistanceKm = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getRoadDistanceKm = async (coords1, coords2) => {
  if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) {
    return 0;
  }

  const [lng1, lat1] = coords1;
  const [lng2, lat2] = coords2;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DeliverHub/1.0" },
    });

    if (!res.ok) {
      throw new Error(`OSRM API error: ${res.status}`);
    }

    const data = await res.json();
    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const distanceMeters = data.routes[0].distance;
      return distanceMeters / 1000; // Convert to KM
    }

    throw new Error("Invalid OSRM response structure");
  } catch (err) {
    console.warn("OSRM routing failed, falling back to straight-line distance:", err.message);
    return calcStraightLineDistanceKm(coords1, coords2);
  }
};
