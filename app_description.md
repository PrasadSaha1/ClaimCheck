What it is
ClaimCheck is a verified return network for public places: campuses, airports, and transit stations. Each place runs its own lost and found with its own map and drop-off desks. AI matches found items to lost reports, and an item only goes back to someone who can prove they own it. The demo has three places: Stony Brook University, JFK Airport, and Penn Station. Adding another is one entry in backend/api/sites.py.
Choosing a place
The home screen has a Location picker. The map, the drop-off desk suggestions, and the impact numbers all follow the chosen place, and the app remembers the choice. Lost reports and found items belong to the place they were posted in, and items from different places never match.
Signing in
The app runs on a laptop at localhost. The first screen has a “Sign in with Google” button, and only @stonybrook.edu accounts are accepted. Anyone else sees a message that the app is for Stony Brook students only. After signing in, users can add an optional phone number in their profile.
Home screen
Two big buttons, “I lost something” and “I found something.” Below them are the user’s open lost reports, the found items they’ve posted, and a notifications inbox. There’s no feed or browse page anywhere in the app.
Posting a found item (the finder)
The finder uploads one or more photos. At least one is required.
They’re encouraged to write a description of anything the photos don’t show, like exactly where it was or what’s inside it.
They can optionally enter a secret detail only the owner would know.
They pin where they found it on the chosen place's map and set when they found it, which defaults to now.
They say where the item is now, either “I have it” or the desk or office they left it at. The app suggests that place's desks.
They submit, and Gemini reviews everything:
It keeps the finder’s secret detail unless it’s vague or visible in every photo. If it replaces it, it picks a better one and tells the finder why. Gemini has the final say.
It hides any photo that shows the secret detail from the public listing.
It writes a public description that’s specific enough for the owner to recognize the item without giving away the secret.
The secret detail must be something the owner would remember without thinking, like a sticker, a keychain, a name written on it, what's inside, or a cracked screen. Never tiny details like a small scratch or a serial number.
It writes a short, plain claim question about that one detail, like “What is stuck on the back of the case?”
It assigns a category.
The finder sees the public listing, plus a private view of the secret detail being used. The item is now active and can show up in matches.
Reporting a lost item (the owner)
The owner writes a description, which is required.
They can optionally upload photos of the item, like an old picture of it.
They pick a category, draw a rough area on the place's map, and set a time window for when they lost it.
They submit. Gemini turns any photos into text and combines them with the description.
They immediately see their matches on the departures board. If nothing matches yet, the report stays open and they get notified when a strong match comes in.
How matching works
Each found item is compared to the lost report two ways. Keyword search catches exact words like brand names or a name written on the item, and meaning-based search with Gemini embeddings catches the same item described with different words. Those two rankings are combined, then adjusted for how close the found location is to the owner’s lost area, whether the found time falls inside their time window, and whether the categories match. Category is just one signal, so a strong match filed under a different category still shows up.
Owners see up to 10 matches, each labeled “Strong match” or “Possible match,” with strong matches listed first. Weak matches below the threshold never appear.
Claiming an item
The owner taps a match and sees its public photos, public description, and roughly where and when it was found.
They tap “Claim this item” and answer the claim question in their own words.
Gemini compares the answer to the secret detail. Owners answer from memory, so a casual answer that names the right thing passes even if the wording or small specifics are off.
Pass: The claim ticket gets stamped. The finder is notified, and both people can now see each other’s name, SBU email, and phone if added. The owner can also see where the item currently is. The item disappears from everyone else’s matches.
Fail: They get one more try.
Unsure: The answer goes to the finder, who approves or rejects it.
After two failed tries, they can’t answer the question again for that item, but they can submit one manual claim request. They explain why it’s theirs and attach proof, like an old photo, a receipt, or a description of what’s inside. The finder approves or rejects it, and can suggest meeting at a front desk to check in person. Approval connects them the same way as a passed claim.
Handoff
After a claim is approved, the item and the lost report sit in “handoff pending.” Once they meet up, either person taps “Mark as returned,” which closes both.
Donating unclaimed items
A found item nobody claims within 30 days of being found is marked as donated instead of sitting in matches forever, unless a claim is still waiting on the finder. The finder gets a notification.
Impact
The home screen shows three numbers for the chosen place, plus a total across the network: items returned to owners, unclaimed items donated, and wrong claims stopped (claims that failed the ownership check or that the finder turned down).
Deleting
Owners can delete their lost reports and finders can delete their found items, but nobody can edit a post after submitting it. Posts can’t be deleted once they’re in handoff.
Notifications (in-app only)
A new strong match for your lost report
Someone passed a claim on your found item
A manual claim request needs your decision
Your manual request was approved or rejected
The other person marked the item as returned
Your found item went unclaimed for 30 days and was marked for donation

