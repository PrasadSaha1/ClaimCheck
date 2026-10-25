"""Places that run their own ClaimCheck. Posts and matches never cross from one place to another."""

SITES = {
    'stony-brook': {
        'name': 'Stony Brook University', 'short': 'Stony Brook', 'kind': 'campus',
        'center': [40.9126, -73.1232], 'zoom': 15,
        'bounds': [[40.86, -73.15], [40.94, -73.06]],
        'desks': ['Student Union info desk', 'Melville Library circulation desk', 'University Police lost & found'],
    },
    'jfk': {
        'name': 'JFK International Airport', 'short': 'JFK Airport', 'kind': 'airport',
        'center': [40.6413, -73.7781], 'zoom': 14,
        'bounds': [[40.62, -73.83], [40.67, -73.74]],
        'desks': ['Terminal 4 information desk', 'Terminal 5 information desk', 'Airport lost & found office'],
    },
    'penn-station': {
        'name': 'Penn Station, New York', 'short': 'Penn Station', 'kind': 'transit station',
        'center': [40.7506, -73.9935], 'zoom': 17,
        'bounds': [[40.745, -74.0], [40.756, -73.987]],
        'desks': ['Amtrak lost & found', 'LIRR lost & found', 'NJ Transit information desk'],
    },
}

DEFAULT_SITE = 'stony-brook'


def site_json(slug):
    return {'id': slug, **SITES[slug]}


def inside(slug, lat, lng):
    (lat_min, lng_min), (lat_max, lng_max) = SITES[slug]['bounds']
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max
