/** Roteiros determinísticos por categoria do Studio, sem reescrita por IA. */

export type MotionTemplateInput = {
  productName: string;
  /** Itens visíveis no primeiro frame que precisam permanecer (bolsa, colar, etc). */
  persistentItems?: string[];
};

function persistence({ productName, persistentItems = [] }: MotionTemplateInput): string {
  const items = Array.from(new Set(["the " + productName, ...persistentItems].map((s) => s.trim()).filter(Boolean)));
  const list =
    items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : (items[0] ?? "the product");
  return `All visible reference-image elements, including ${list}, remain present, unchanged in shape, color, print, scale and position relationship, and visually continuous for the entire take.`;
}

function templateA(input: MotionTemplateInput): string {
  return [
    "The video starts with the subject in a medium shot, front-facing, lips in a soft purse, neutral gaze directly into the camera, with both hands hanging relaxed at her sides.",
    "At 0.0s, the subject purses her lips into a small pout and slightly lowers her chin, then raises both hands from her lower-mid-torso up to touch her mid-torso with fingers splayed, elbows bent.",
    "Between 0.5s and 1.2s, she shifts her weight slightly to the right, moves both hands down to rest on her lower stomach, fingertips touching, then smoothly lowers them to hang at her sides, with lips relaxing slightly.",
    "From 1.2s to 2.5s, her lips fully relax to a closed mouth, neutral expression, and her hands subtly adjust the waist fabric on both sides before lowering again, with a slight hip sway to the right.",
    "Between 2.5s and 3.4s, she maintains a neutral pose, then raises her hands slightly to gently pull at the fabric near her waist, with minor shoulder lift.",
    "From 3.4s to 4.1s, her hands drop to her sides, then her left hand points downward with the index finger while her right hand slightly tucks into her right hip, as hips sway left.",
    "Between 4.1s and 4.8s, both arms extend outwards and then her right hand raises to touch her hair above her right ear, while her left arm stays slightly bent, with lips slightly parted.",
    "From 4.8s to 5.8s, the subject smoothly rotates her torso 90 degrees to her right, bringing her right hand down towards her hip, and turns her head to look over her left shoulder towards the camera.",
    "Between 5.8s and 6.8s, she continues rotating her upper body further to her right, raising both hands simultaneously to the back of her head, then smoothly lowering them to her sides, her head moving to face forward over her right shoulder.",
    "Finally, from 6.8s to 8.0s, the subject slowly rotates her torso back towards the camera, lifting her left hand to rest on her left hip, while her head sweeps back towards the camera, pausing with a gentle smile and a slight head angle.",
    persistence(input),
    "The subject remains completely silent throughout the video.",
    "The camera focal length and zoom stay locked, no zoom in, no zoom out, no FOV change at any point.",
    "This is one continuous take, with no cuts, no jumps, no reframes, and no sudden distance changes.",
    "The camera remains static and maintains a medium framing throughout the entire video.",
  ].join(" ");
}

function templateB(input: MotionTemplateInput): string {
  return [
    "The video starts with the subject facing the camera, standing in a medium-wide shot from knees-up, both hands lightly gripping the waistband of their outfit, making small adjustments, with a soft, neutral expression and a slight head tilt to the left at 0.0s.",
    "Between 0.0s and 0.9s, the subject straightens their head and continues light adjustments with both hands at the waist.",
    "From 0.9s to 2.5s, the subject holds this pose, continuing the small adjustment and maintaining direct eye contact with the camera.",
    "Between 2.5s and 3.7s, the subject slowly rotates their head 45 degrees to their left, while the right hand gradually moves to rest on their right hip, fingers splayed, and the left hand remains at the waist.",
    "This pose is held from 3.7s to 4.4s, with the gaze fixed to the left.",
    "The subject then smoothly rotates their head back to center, eyes returning to the camera, and both hands return to briefly adjust the waist between 4.4s and 5.6s.",
    "From 5.6s to 6.4s, the hands drop to the sides, and the head and upper torso smoothly rotate approximately 60 degrees to the subject's right, shifting their gaze right.",
    "Between 6.4s and 7.2s, the upper body continues rotating further right by an additional 50 degrees, presenting almost their full back to the camera.",
    "In the final beat, from 7.2s to 8.0s, the rotation continues with the head turning back over the left shoulder to look towards the camera, a slight smirk beginning to form, and both hands positioned on the back of the hips.",
    persistence(input),
    "The subject remains completely silent throughout the video.",
    "The camera focal length and zoom stay locked, no zoom in, no zoom out, no FOV change at any point.",
    "This is one continuous take, with no cuts, no jumps, no reframes, and no sudden distance changes.",
    "The camera remains static throughout the clip, maintaining a consistent medium-wide framing.",
  ].join(" ");
}

function showProductTemplateA(): string {
  return [
    "The video starts with the subject standing in a medium shot, facing the camera directly, holding the selected product with both hands at lower-mid-torso level, centered in front of her body. Her elbows remain naturally bent, shoulders relaxed, and her expression is neutral and composed, with direct eye contact at 0.0s.",
    "Between 0.0s and 1.0s, she gently adjusts her grip on the product with both hands, keeping the product centered and fully visible to the camera, then begins raising it slowly from lower-mid-torso toward upper-mid-torso.",
    "From 1.0s to 2.2s, she continues lifting the product smoothly until it reaches chest level, keeping both hands symmetrically positioned around it. Her elbows move slightly outward as her wrists naturally adjust, while her gaze remains directed toward the camera.",
    "Between 2.2s and 3.3s, she holds the product steadily at chest level and subtly angles it forward toward the camera, rotating it only slightly so the main front-facing surface remains clearly visible. Her head remains centered with a calm, soft expression.",
    "From 3.3s to 4.4s, she makes a small controlled adjustment with her fingers around the sides of the product, maintaining the same height and orientation while keeping the product continuously visible and unobstructed.",
    "Between 4.4s and 5.5s, she shifts her weight subtly onto her right leg while keeping the product centered in front of her chest. Her shoulders follow the weight shift naturally without changing the camera-facing orientation of the product.",
    "From 5.5s to 6.5s, she slowly extends the product a few centimeters forward toward the camera with both hands, presenting it more prominently, while keeping her arms controlled and her wrists stable. Her eyes remain on the camera.",
    "Between 6.5s and 7.2s, she smoothly brings the product slightly back toward her chest, maintaining the same front-facing orientation and keeping both hands securely supporting it.",
    "Finally, from 7.2s to 8.0s, she settles into a stable presentation pose with the product held centered at chest level, both hands supporting it from the sides and bottom, her shoulders relaxed, and a subtle gentle smile forming while she maintains direct eye contact with the camera.",
    "All visible reference-image elements, including the selected product, clothing, accessories, colors, textures, logos, prints, proportions, and physical details, remain present and visually continuous throughout the entire take. The selected product remains identical in shape, size, color, labeling, texture, and orientation relative to her hands, with no deformation, duplication, disappearance, or unwanted changes.",
    "The subject remains completely silent throughout the video. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, and no camera movement at any point. This is one continuous take with no cuts, no jumps, no transitions, no reframes, and no sudden distance changes. The camera remains static and maintains a consistent medium framing throughout the entire video.",
  ].join(" ");
}

function showProductTemplateB(): string {
  return [
    "The video starts with the subject standing in a medium-wide shot from approximately the knees up, facing the camera, holding the selected product with both hands near her lower-mid-torso. The product is centered between her hands and clearly visible, while her elbows remain naturally bent and her expression is soft and neutral at 0.0s.",
    "Between 0.0s and 0.9s, she gently raises the product upward with both hands, keeping her wrists aligned and her movements slow and controlled. Her head remains facing the camera and her gaze stays directed forward.",
    "From 0.9s to 2.0s, she brings the product to chest level and slightly separates her elbows from her torso, creating a clear presentation position. Her fingers adjust naturally around the product without covering its main visible surface.",
    "Between 2.0s and 3.1s, she slowly rotates the product a small amount clockwise using both hands, revealing a slightly different angle while keeping the product centered between her shoulders. Her eyes remain on the camera and her expression stays composed.",
    "From 3.1s to 4.2s, she returns the product smoothly to its original front-facing orientation, then holds it steadily at chest height. Her shoulders remain relaxed and her body stays mostly still.",
    "Between 4.2s and 5.2s, she subtly shifts her weight to her left leg and moves the product a few centimeters forward, presenting it closer to the camera without changing its scale through any camera movement.",
    "From 5.2s to 6.2s, she holds the product forward for a brief presentation moment, making a tiny natural adjustment with her thumbs and fingers while ensuring the product remains unobstructed.",
    "Between 6.2s and 7.1s, she smoothly draws the product back toward her chest and slightly lowers it, keeping both hands connected to it throughout the movement and maintaining its upright orientation.",
    "Finally, from 7.1s to 8.0s, she settles with the product centered just below chest level, both hands supporting it naturally, her torso facing directly toward the camera, and a subtle confident smile appearing as she holds the final presentation pose.",
    "All visible reference-image elements, including the selected product, clothing, accessories, colors, textures, logos, prints, proportions, and physical details, remain present and visually continuous throughout the entire take. The selected product remains identical in shape, size, color, labeling, texture, and structure throughout the motion, with no deformation, morphing, duplication, disappearance, floating, or unexpected changes. The subject's hands maintain physically consistent contact with the product at all times.",
    "The subject remains completely silent throughout the video. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, no dolly movement, and no camera repositioning. This is one continuous take with no cuts, no jumps, no transitions, no reframes, and no sudden distance changes. The camera remains static and maintains a consistent medium-wide framing throughout the entire video.",
  ].join(" ");
}

function reviewTemplateA(): string {
  return [
    "The video starts with the subject standing in a medium shot, facing the camera directly, holding the selected product with both hands at lower-mid-torso level. The product is centered in front of her body and clearly visible to the camera. Her elbows are naturally bent, shoulders relaxed, and she looks directly into the lens with a friendly, confident expression at 0.0s.",
    "Between 0.0s and 0.8s, she raises the product smoothly from lower-mid-torso to chest level while maintaining eye contact with the camera. As the product reaches chest height, she begins speaking naturally to the camera with a conversational expression.",
    "From 0.8s to 2.0s, she continues speaking while holding the product securely with both hands. She makes a small nod and slightly lifts the product toward the camera for emphasis, keeping its main visible surface unobstructed.",
    "Between 2.0s and 3.2s, while continuing to speak, she briefly shifts her right hand to gesture beside the product, using a small open-palm gesture, while her left hand continues supporting the product. Her gaze remains directed toward the camera.",
    "From 3.2s to 4.3s, she brings her right hand back to the product and gently rotates it a small amount toward the camera, as if showing an important feature, while continuing her natural spoken explanation.",
    "Between 4.3s and 5.4s, she holds the product steady and makes a subtle affirmative nod while speaking. Her facial expression becomes slightly more enthusiastic, but remains natural and controlled.",
    "From 5.4s to 6.4s, she extends the product slightly forward with both hands, presenting it closer to the camera while continuing to speak, then pauses the forward movement without changing the product's shape or orientation.",
    "Between 6.4s and 7.2s, she smoothly brings the product back toward her chest, maintaining direct eye contact and continuing the explanation with a small natural hand adjustment.",
    "Finally, from 7.2s to 8.0s, she holds the product centered at chest level with both hands, finishes her spoken point with a subtle nod and a slight confident smile, maintaining direct eye contact with the camera.",
    "The subject speaks naturally throughout the video as if personally reviewing and recommending the selected product to the viewer. Her speech is conversational, clear, and synchronized with natural mouth movement. Do not generate subtitles, captions, text overlays, or additional graphics.",
    "All visible reference-image elements, including the selected product, clothing, accessories, colors, textures, logos, prints, proportions, and physical details, remain present and visually continuous throughout the entire take. The selected product remains identical in shape, size, color, labeling, texture, and structure throughout the motion, with no deformation, morphing, duplication, disappearance, floating, or unexpected changes. Her hands maintain physically consistent contact with the product at all times.",
    "The subject remains facing the camera throughout the explanation. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, and no camera movement at any point. This is one continuous take with no cuts, no jumps, no transitions, no reframes, and no sudden distance changes. The camera remains static and maintains a consistent medium framing throughout the entire video.",
  ].join(" ");
}

function reviewTemplateB(): string {
  return [
    "The video starts with the subject standing in a medium-wide shot from approximately the knees up, facing the camera directly and holding the selected product with both hands at waist level. The product is clearly visible between her hands, her posture is relaxed, and she looks directly into the camera with a friendly, confident expression at 0.0s.",
    "Between 0.0s and 1.0s, she raises the product smoothly toward chest level while beginning to speak naturally to the camera. Her elbows remain slightly bent and her shoulders stay relaxed.",
    "From 1.0s to 2.1s, she continues speaking while holding the product centered in front of her chest. She briefly tilts the product slightly toward the camera, drawing attention to its main visible feature, then returns it to a stable position.",
    "Between 2.1s and 3.2s, she shifts her right hand away from the product and makes a small explanatory gesture beside it, palm facing slightly upward, as if emphasizing a benefit or characteristic. Her left hand continues supporting the product securely and her gaze remains on the camera.",
    "From 3.2s to 4.3s, she brings her right hand back to the product and slowly rotates it a small amount to reveal another visible side while continuing her spoken review. The rotation is controlled and continuous, with no sudden movement.",
    "Between 4.3s and 5.3s, she stops the rotation and holds the product at the new angle while speaking. She gives a subtle nod and briefly raises her eyebrows to naturally emphasize the point she is making.",
    "From 5.3s to 6.3s, she returns the product smoothly to a front-facing orientation and slightly extends both hands forward, presenting it clearly to the viewer while continuing to speak.",
    "Between 6.3s and 7.2s, she gently draws the product back toward her body, keeping it at chest level, while making a small natural gesture with her right thumb and fingers around the product as she continues explaining.",
    "Finally, from 7.2s to 8.0s, she settles into a stable final pose with the product centered at chest level, looks directly into the camera, finishes her spoken sentence with a subtle smile and a small affirmative nod.",
    "The subject speaks naturally throughout the entire video as if giving a concise product review directly to the viewer. Her facial expressions, lip movement, pauses, and small gestures remain synchronized with natural conversational speech. Do not generate subtitles, captions, text overlays, or additional graphics.",
    "All visible reference-image elements, including the selected product, clothing, accessories, colors, textures, logos, prints, proportions, and physical details, remain present and visually continuous throughout the entire take. The selected product remains identical in shape, size, color, labeling, texture, and structure throughout the motion, with no deformation, morphing, duplication, disappearance, floating, or unexpected changes. The subject's hands maintain physically consistent contact with the product whenever they are holding it.",
    "The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, no dolly movement, and no camera repositioning. This is one continuous take with no cuts, no jumps, no transitions, no reframes, and no sudden distance changes. The camera remains static and maintains a consistent medium-wide framing throughout the entire video.",
  ].join(" ");
}

function unboxingTemplateA(): string {
  return `The video starts with the subject standing in a medium shot, facing the camera directly, holding the unopened selected product package with both hands at lower-mid-torso level. The package is clearly visible and centered in front of her body. She looks directly into the camera with a curious, excited but natural expression at 0.0s.

Between 0.0s and 0.9s, she looks briefly down toward the package while keeping both hands securely around it, then looks back toward the camera as if introducing the unboxing. Her fingers naturally adjust their grip around the edges of the package.

From 0.9s to 2.0s, she lowers her gaze to the package and begins opening it carefully, using her right hand to locate and loosen the main opening while her left hand keeps the package stable. Her movements are deliberate and physically continuous.

Between 2.0s and 3.1s, she continues opening the package, pulling the flap or opening mechanism toward herself with her right hand while her left hand supports the package. The opening gradually becomes visible, with no sudden changes to the packaging.

From 3.1s to 4.2s, she looks inside the opened package with a natural moment of curiosity, slightly tilting her head downward while keeping the package clearly visible to the camera.

Between 4.2s and 5.3s, she carefully reaches inside the opened package with her right hand while her left hand continues holding the package steady. Her fingers make contact with the selected product inside and begin lifting it slowly.

From 5.3s to 6.3s, she smoothly pulls the selected product out of the package, raising it toward chest level while keeping the packaging in her left hand. Her expression changes naturally to mild pleasant surprise as she looks at the product.

Between 6.3s and 7.2s, she brings the product fully into view and turns it slightly toward the camera, keeping it supported securely in her right hand while the opened package remains visible in her left hand.

Finally, from 7.2s to 8.0s, she looks directly into the camera with a subtle satisfied smile, holding the newly unboxed product prominently at chest level while keeping the opened packaging slightly lower and to the side.

All visible reference-image elements, including the selected product, packaging, clothing, accessories, colors, textures, logos, labels, prints, proportions, and physical details, remain visually continuous throughout the entire take. The unopened package remains consistent until it is physically opened, and the selected product only becomes visible as it is naturally removed from inside the package. The product does not change shape, color, size, labeling, texture, or design during the unboxing. No duplicate products appear, and nothing disappears or morphs unnaturally.

The subject remains completely silent throughout the video. No subtitles, captions, text overlays, or additional graphics appear. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, and no camera movement at any point. This is one continuous take with no cuts, no jumps, no transitions, no reframes, and no sudden distance changes. The camera remains static and maintains a consistent medium framing throughout the entire video.`;
}

function unboxingTemplateB(): string {
  return `The video starts with the subject standing in a medium-wide shot from approximately the knees up, facing the camera while holding the unopened selected product package with both hands at waist level. The package is centered and clearly visible, with her fingers naturally positioned around its sides. She has a soft, anticipatory expression and looks directly into the camera at 0.0s.

Between 0.0s and 0.8s, she shifts her gaze from the camera down toward the package and slightly raises it toward her chest, preparing to open it. Her left hand stabilizes the package while her right hand moves toward the primary opening.

From 0.8s to 1.9s, she uses her right hand to carefully open the package, lifting the flap or separating the opening while her left hand maintains a firm but natural grip. The opening action progresses gradually with realistic hand movement.

Between 1.9s and 3.0s, she continues opening the package and slightly angles it toward herself so she can see inside. Her head follows the movement naturally, with her gaze focused on the contents.

From 3.0s to 4.0s, she pauses briefly while looking inside the package, then reaches into the opening with her right hand. Her left hand remains underneath and around the package for support.

Between 4.0s and 5.2s, her right hand securely grips the selected product inside the package and begins pulling it upward. The product gradually emerges from the packaging, remaining physically connected to her hand and moving continuously with it.

From 5.2s to 6.2s, she completely removes the product from the package and raises it to chest level. She naturally looks at the product for a brief moment, with a subtle expression of pleasant discovery.

Between 6.2s and 7.1s, she turns the product slightly toward the camera, presenting its main visible surface while keeping the opened package in her opposite hand. Her shoulders remain relaxed and her posture stays stable.

Finally, from 7.1s to 8.0s, she looks back toward the camera and gives a small satisfied smile, holding the newly unboxed product prominently in front of her chest while the opened package remains visible beside it.

All visible reference-image elements, including the selected product, packaging, clothing, accessories, colors, textures, logos, labels, prints, proportions, and physical details, remain present and visually continuous throughout the entire take. The package remains unopened until the opening action begins. The selected product emerges only from inside the package and remains identical in shape, size, color, labeling, texture, and structure after being removed. No duplicate products, replacement objects, deformation, morphing, disappearance, floating objects, or unexplained changes occur.

The subject remains completely silent throughout the video. No subtitles, captions, text overlays, or additional graphics appear. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, no dolly movement, and no camera repositioning. This is one continuous take with no cuts, no jumps, no transitions, no reframes, and no sudden distance changes. The camera remains static and maintains a consistent medium-wide framing throughout the entire video.`;
}

function beforeAfterTemplateA(): string {
  return `The video starts with the subject standing in a medium shot, facing the camera directly. She holds the selected product naturally at lower-mid-torso level with both hands, presenting the initial state clearly to the viewer. Her expression is neutral and composed, with direct eye contact at 0.0s.

Between 0.0s and 1.0s, she raises the product slightly toward chest level and briefly looks at it, then returns her gaze to the camera. Her posture remains relaxed and stable, clearly establishing the “before” moment.

From 1.0s to 2.0s, she lowers the product gently and shifts her body slightly to the right, maintaining a clear view of herself and the product. She gives a subtle gesture toward the area relevant to the product's effect, without obscuring the product.

Between 2.0s and 3.0s, she returns to a centered position and holds a clear neutral “before” pose for a brief moment, looking directly into the camera. Her expression remains calm and unchanged.

From 3.0s to 3.6s, she smoothly brings both hands toward the center of her body and makes a small natural transition gesture, briefly lowering the product out of the primary focus while maintaining continuous body movement.

Between 3.6s and 4.0s, she smoothly raises the product back into view as she transitions into the “after” presentation. Her posture becomes slightly more confident and her facial expression changes naturally into a subtle pleased expression.

From 4.0s to 5.2s, she holds the product at chest level and presents herself in the improved “after” state, maintaining direct eye contact with the camera. Her shoulders are relaxed and her posture is slightly more upright.

Between 5.2s and 6.3s, she gently gestures toward the visible result with her free hand, then returns that hand to support the product, keeping the product clearly visible.

From 6.3s to 7.2s, she subtly turns her torso a few degrees to the side and back toward the camera, allowing the viewer to observe the “after” state from a slightly different natural angle without changing the camera position.

Finally, from 7.2s to 8.0s, she returns fully toward the camera, holds the product prominently at chest level with both hands, and finishes with a confident, satisfied smile.

The transition from the “before” state to the “after” state remains visually continuous and easy to understand. The subject, selected product, clothing, accessories, environment, lighting, and camera position remain consistent throughout the take. The selected product remains identical in shape, size, color, labeling, texture, and structure, with no deformation, morphing, duplication, or disappearance.

The subject remains completely silent throughout the video. No subtitles, captions, text overlays, split screens, transitions, wipes, or additional graphics appear. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, and no camera movement. This is one continuous take with no cuts, jumps, or reframes. The camera remains static and maintains a consistent medium framing throughout.`;
}

function beforeAfterTemplateB(): string {
  return `The video starts with the subject standing in a medium-wide shot from approximately the knees up, facing the camera directly. She holds the selected product naturally in her right hand at lower-mid-torso level while her left hand rests relaxed near her side. Her posture and expression are neutral, clearly establishing the initial “before” state at 0.0s.

Between 0.0s and 1.0s, she looks directly into the camera and makes a small gesture toward herself with her left hand, then briefly looks toward the product. Her body remains mostly still, allowing the initial state to remain clearly visible.

From 1.0s to 2.1s, she brings the product toward the center of her body and holds it with both hands at waist level. She makes a subtle downward glance toward the product and then returns her gaze to the camera.

Between 2.1s and 3.0s, she slowly lowers the product slightly while maintaining a neutral expression and stable posture, creating a clear final beat for the “before” presentation.

From 3.0s to 3.8s, she smoothly shifts her weight from her right leg to her left leg while raising the product back toward chest level. Her torso follows the movement naturally, creating a continuous transition into the “after” state.

Between 3.8s and 4.8s, she settles into a noticeably more confident upright posture while holding the product centered at chest level. Her expression changes gradually into a subtle smile, without any abrupt facial transformation.

From 4.8s to 5.9s, she extends the product slightly toward the camera with both hands, then brings it back toward her chest while maintaining eye contact. Her free fingers make a small natural gesture emphasizing the result.

Between 5.9s and 6.9s, she turns her torso approximately 20 degrees to her right while continuing to hold the product securely, briefly presenting the “after” state from a slightly angled position.

From 6.9s to 7.4s, she smoothly rotates her torso back toward the camera, returning to a fully frontal position while keeping the product centered.

Finally, from 7.4s to 8.0s, she holds the product at chest level with both hands, maintains direct eye contact, and finishes with a confident, satisfied smile that clearly communicates the completed “after” state.

The visual difference between the “before” and “after” states is clearly established through the subject's posture, presentation, and intended product result while preserving realistic continuity. The selected product remains identical throughout the entire take, with no changes to its shape, size, color, labeling, texture, or structure. No objects appear or disappear unexpectedly, and there is no morphing or duplication.

The subject remains completely silent throughout the video. No subtitles, captions, text overlays, split screens, wipes, or graphic transitions appear. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, no camera movement, and no reframing. This is one continuous take with no cuts or jumps. The camera remains static and maintains a consistent medium-wide framing throughout the entire video.`;
}

function productInUseTemplateA(): string {
  return "The video starts with the subject standing in a medium shot, facing the camera directly, holding the selected product naturally with both hands at lower-mid-torso level. The product is clearly visible and positioned exactly as it would normally be held before use. Her shoulders are relaxed, her expression is neutral and focused, and she briefly looks toward the camera at 0.0s.\n\nBetween 0.0s and 0.8s, she lowers her gaze from the camera toward the selected product and naturally adjusts her grip with both hands, positioning her fingers correctly for its intended use. Her elbows remain relaxed and close to her body.\n\nFrom 0.8s to 1.8s, she brings the product smoothly toward the appropriate area where it is normally used, rotating her wrists and adjusting her hands only as necessary to maintain a realistic physical orientation. Her eyes follow the product throughout the movement.\n\nBetween 1.8s and 3.0s, she begins using the product in its normal intended manner, performing one slow, deliberate application or operating motion. Her dominant hand controls the main action while the opposite hand naturally stabilizes either the product or the relevant area when appropriate.\n\nFrom 3.0s to 4.1s, she continues the same usage action with a second smooth motion, maintaining consistent contact and realistic pressure. Her head tilts slightly toward the action as she watches what she is doing, with a focused but relaxed expression.\n\nBetween 4.1s and 5.1s, she briefly pauses the active motion while keeping the product correctly positioned, subtly adjusts her grip, then resumes using it with one smaller controlled movement. The product remains physically connected to her hand throughout the sequence.\n\nFrom 5.1s to 6.1s, she completes the final usage motion and smoothly moves the product away from the application area, lowering it slightly toward mid-torso level. Her gaze follows the product briefly before shifting toward the visible result.\n\nBetween 6.1s and 7.1s, she naturally observes the result for a moment, then looks back toward the camera with a subtle pleased expression. She keeps the selected product visible in one hand while the other hand relaxes naturally beside the area where it was used.\n\nFinally, from 7.1s to 8.0s, she raises the product slightly beside her torso so it remains clearly visible, returns her full gaze to the camera, and finishes with a small satisfied smile and a subtle affirmative nod.\n\nThe selected product is used according to its visually apparent intended function and physical design. All hand positions, contact points, finger movements, wrist rotations, and product orientation remain physically coherent throughout the demonstration. The product never floats, teleports, passes through the subject's hands or body, changes hands without a visible transfer, or performs an action inconsistent with its physical structure.\n\nAll visible reference-image elements, including the selected product, clothing, accessories, colors, textures, logos, labels, prints, proportions, and physical details, remain present and visually continuous throughout the entire take. The selected product remains identical in shape, size, color, labeling, texture, and structure, with no deformation, morphing, duplication, disappearance, replacement, or unexplained transformation.\n\nThe subject remains completely silent throughout the video. No subtitles, captions, text overlays, or additional graphics appear. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, and no camera movement at any point. This is one continuous take with no cuts, no jumps, no transitions, no reframes, and no sudden distance changes. The camera remains static and maintains a consistent medium framing throughout the entire video.";
}

function productInUseTemplateB(): string {
  return "The video starts with the subject standing in a medium-wide shot from approximately the knees up, facing slightly toward the camera while holding the selected product in the hand most naturally suited to its intended use. Her opposite hand rests relaxed near her waist. The product is clearly visible, her posture is natural, and she looks directly into the camera with a soft neutral expression at 0.0s.\n\nBetween 0.0s and 0.9s, she briefly presents the product toward the camera at mid-torso level, then shifts her gaze from the camera toward the product while bringing her opposite hand toward it to prepare for use.\n\nFrom 0.9s to 1.9s, she adjusts the product into its correct functional orientation using both hands, then smoothly moves it toward the appropriate area of use. Her head and eyes naturally follow the movement.\n\nBetween 1.9s and 3.1s, she begins actively using the product, performing a slow and clearly readable functional motion. Her dominant hand guides the product while her opposite hand provides natural support when necessary, with her shoulders and elbows moving subtly to accommodate the action.\n\nFrom 3.1s to 4.2s, she continues using the product with another controlled motion in the same direction and manner, maintaining consistent physical contact and realistic hand placement. Her expression remains focused and comfortable.\n\nBetween 4.2s and 5.2s, she slightly changes the product's position and performs one final shorter usage motion, smoothly completing the demonstration without interrupting the physical continuity of the action.\n\nFrom 5.2s to 6.1s, she stops the active use and gently moves the product away from the application area. Her opposite hand briefly interacts with or checks the resulting area in a natural manner while the product remains securely held in her other hand.\n\nBetween 6.1s and 7.0s, she looks at the result with a subtle expression of approval, then smoothly raises her gaze back toward the camera. Her posture becomes slightly more relaxed as the demonstration ends.\n\nFinally, from 7.0s to 8.0s, she brings the selected product back into a clearly visible position near chest level, turns its main recognizable surface toward the camera, and finishes with a natural satisfied smile and a small confident nod.\n\nThe selected product is actively demonstrated according to its visually apparent intended function. The motion adapts naturally to the physical form of the reference product rather than forcing a generic interaction. Hands and fingers maintain anatomically correct contact and grip throughout the demonstration, and every change in product position occurs through visible continuous hand movement.\n\nAll visible reference-image elements, including the selected product, clothing, accessories, colors, textures, logos, labels, prints, proportions, and physical details, remain present and visually continuous throughout the entire take. The product remains identical throughout the video, with no deformation, morphing, duplication, disappearance, floating, spontaneous opening, incorrect articulation, or unexpected changes in size, color, structure, or orientation.\n\nThe subject remains completely silent throughout the video. No subtitles, captions, text overlays, or additional graphics appear. The camera focal length and zoom stay locked, with no zoom in, no zoom out, no FOV change, no dolly movement, and no camera repositioning. This is one continuous take with no cuts, no jumps, no transitions, no reframes, and no sudden distance changes. The camera remains static and maintains a consistent medium-wide framing throughout the entire video.";
}

function povTemplateA(): string {
  return "The video starts from a first-person POV perspective, as if the camera is the subject's own eyes. Both of the subject's hands are visible naturally in the lower portion of the frame, holding the selected product in front of her. The product is centered and clearly visible, with the environment remaining consistent and naturally framed from the subject's eye level at 0.0s.\n\nBetween 0.0s and 0.9s, both hands gently adjust their grip around the selected product, positioning it naturally for use. The movement is slow and deliberate, with the product remaining centered in the POV frame.\n\nFrom 0.9s to 2.0s, the hands smoothly bring the product closer toward the intended area of use, with the camera perspective moving naturally with the subject's head and upper body. The product remains clearly visible and physically connected to the hands.\n\nBetween 2.0s and 3.2s, the subject begins using the product in its visually apparent intended manner. The dominant hand performs the primary movement while the opposite hand naturally supports or stabilizes the product. The motion remains smooth and realistic from the first-person perspective.\n\nFrom 3.2s to 4.3s, the same action continues with a second controlled movement, maintaining consistent hand placement and product orientation. The camera remains at natural eye level with only subtle head movement.\n\nBetween 4.3s and 5.3s, the hands slightly reposition the product and perform one final deliberate usage motion. The product remains continuously visible without suddenly changing position or scale.\n\nFrom 5.3s to 6.3s, the hands smoothly move the product away from the usage area and hold it slightly lower, allowing the viewer to clearly see the result of the interaction from the subject's perspective.\n\nBetween 6.3s and 7.2s, the product is brought back toward the center of the frame and briefly held there, as if the subject is inspecting it after use.\n\nFinally, from 7.2s to 8.0s, the selected product is held prominently in both hands directly in front of the POV camera, with a subtle natural movement suggesting satisfaction with the result.\n\nThe entire video remains a true first-person POV perspective. The camera represents the subject's eye position and moves naturally with subtle head and body motion. No third-person view of the subject appears at any point.\n\nAll visible reference-image elements, including the selected product, packaging, clothing elements visible from the POV, accessories, colors, textures, logos, labels, prints, proportions, and physical details, remain visually continuous throughout the entire take. The selected product remains identical in shape, size, color, labeling, texture, and structure, with no deformation, morphing, duplication, disappearance, floating, or unexpected transformation. Hands maintain physically consistent contact with the product throughout.\n\nThe subject remains completely silent throughout the video. No subtitles, captions, text overlays, or additional graphics appear. The POV camera maintains a natural human eye-level perspective with a consistent focal length. There is no artificial zoom, no zoom in, no zoom out, no FOV change, no third-person camera movement, and no sudden camera repositioning. This is one continuous first-person take with no cuts, jumps, transitions, or reframes.";
}

function povTemplateB(): string {
  return "The video starts from a natural first-person POV perspective at approximately eye level. The selected product is positioned in front of the viewer on a nearby surface, clearly visible and within comfortable arm's reach. The subject's hands are initially relaxed near the bottom edges of the frame at 0.0s.\n\nBetween 0.0s and 1.0s, the subject's right hand moves naturally into the frame and reaches toward the selected product while the left hand remains relaxed. The hand approaches the product at a realistic speed and makes clear physical contact with it.\n\nFrom 1.0s to 2.0s, the right hand securely grips the product and lifts it from the surface. The left hand then moves into the frame to support the opposite side, creating a stable two-handed grip.\n\nBetween 2.0s and 3.0s, both hands bring the product closer toward the camera, allowing the viewer to inspect its visible details from the first-person perspective. The product remains centered without excessive movement.\n\nFrom 3.0s to 4.1s, the hands naturally rotate the product slightly to reveal another side or functional area, then smoothly return it toward its primary orientation. The rotation is controlled and physically consistent with the product's structure.\n\nBetween 4.1s and 5.2s, the subject begins using the product in its visually apparent intended manner. The dominant hand performs the primary action while the opposite hand provides support, with realistic finger placement and wrist movement.\n\nFrom 5.2s to 6.2s, the usage action continues for one additional controlled motion. The POV camera remains stable while following only the subtle natural movement of the subject's head and upper body.\n\nBetween 6.2s and 7.1s, the hands stop using the product and bring it back toward the center of the frame, holding it at a comfortable viewing distance as if inspecting the result.\n\nFinally, from 7.1s to 8.0s, both hands hold the product prominently in front of the camera for a final POV presentation, keeping its main recognizable surface facing the viewer.\n\nThe entire sequence remains strictly first-person POV. The viewer should feel as though they are physically holding and using the product themselves. Only the subject's hands and naturally visible portions of the immediate environment appear; never reveal the subject's face or switch to an external camera angle.\n\nAll visible reference-image elements, including the selected product, packaging, colors, textures, logos, labels, prints, proportions, and physical details, remain visually continuous throughout the entire take. The selected product remains identical in shape, size, color, labeling, texture, and structure throughout the sequence. No deformation, morphing, duplication, disappearance, floating objects, impossible hand positions, or unexplained object transformations occur.\n\nThe subject remains completely silent throughout the video. No subtitles, captions, text overlays, or additional graphics appear. The camera maintains a natural human eye-level POV with locked focal characteristics. No artificial zoom, no zoom in, no zoom out, no FOV change, no third-person perspective, and no sudden camera movement. This is one continuous POV take with no cuts, jumps, transitions, or reframes.";
}

export const MOTION_TEMPLATES = [templateA, templateB];
export const SHOW_PRODUCT_MOTION_TEMPLATES = [showProductTemplateA, showProductTemplateB];
export const REVIEW_MOTION_TEMPLATES = [reviewTemplateA, reviewTemplateB];
export const UNBOXING_MOTION_TEMPLATES = [unboxingTemplateA, unboxingTemplateB];
export const BEFORE_AFTER_MOTION_TEMPLATES = [beforeAfterTemplateA, beforeAfterTemplateB];
export const PRODUCT_IN_USE_MOTION_TEMPLATES = [productInUseTemplateA, productInUseTemplateB];
export const POV_MOTION_TEMPLATES = [povTemplateA, povTemplateB];

/** Escolhe o par da categoria e alterna seus dois roteiros pela variação. */
export function buildMotionScript(input: MotionTemplateInput, variation = 1, contentTypeId = "usando"): string {
  const templates = contentTypeId === "mostrar"
    ? SHOW_PRODUCT_MOTION_TEMPLATES
    : contentTypeId === "review"
      ? REVIEW_MOTION_TEMPLATES
      : contentTypeId === "unboxing"
        ? UNBOXING_MOTION_TEMPLATES
        : contentTypeId === "antes-depois"
          ? BEFORE_AFTER_MOTION_TEMPLATES
          : contentTypeId === "em-uso"
            ? PRODUCT_IN_USE_MOTION_TEMPLATES
            : contentTypeId === "pov"
              ? POV_MOTION_TEMPLATES
              : MOTION_TEMPLATES;
  const index = (Math.max(1, variation) - 1) % templates.length;
  return templates[index]!(input);
}
