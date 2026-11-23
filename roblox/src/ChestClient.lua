--[[
	UltraRareChest / ChestClient   (Script, RunContext = Client)

	Demo for the ChestOpenUltraRare R15 animation. It builds the treasure
	chest, shows a ProximityPrompt and, when the local player opens it:
	  * places the character in front of the chest and plays the animation,
	  * drives the lid every frame from AnimationTrack.TimePosition, so the
	    hands stay on the lid,
	  * fires the light burst, particles, reward crystal and the banner,
	  * runs a cinematic camera (the character turns to face it at the end).

	Model layout (UltraRareChestKit.rbxmx):
	  UltraRareChest (Model)
	    Anchor            - invisible part at the chest base centre. Its
	                        LookVector points from the player towards the chest.
	    ChestOpenUltraRare (KeyframeSequence)
	    AnimationId       (StringValue) - "rbxassetid://..." after you publish.
	                        Empty = Studio only (temporary id from the sequence).
	    CinematicCamera   (BoolValue)
	    ChestClient       (this script) + ChestOpeningData (generated module)

	Everything here runs on the client, so the chest opening is a personal
	reveal; the character animation itself replicates to other players.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local KeyframeSequenceProvider = game:GetService("KeyframeSequenceProvider")

local model = script.Parent
local anchor = model:WaitForChild("Anchor")
local sequence = model:WaitForChild("ChestOpenUltraRare")
local DATA = require(script:WaitForChild("ChestOpeningData"))
local player = Players.LocalPlayer

local CH = DATA.Chest
local W, D, BH = CH.Width, CH.Depth, CH.BaseHeight
local CZ, FZ = CH.CenterZ, CH.FrontZ
local T_BURST = DATA.Markers.LidBurst
local T_LAND = DATA.Markers.Land

local GOLD = Color3.fromRGB(255, 194, 61)
local WOOD = Color3.fromRGB(110, 62, 30)
local GLOW = Color3.fromRGB(255, 214, 120)

---------------------------------------------------------------------- helpers
local function clamp(x, a, b)
	if x < a then
		return a
	elseif x > b then
		return b
	end
	return x
end
local function lerp(a, b, s)
	return a + (b - a) * s
end
local function smooth(a, b, x)
	local s = clamp((x - a) / (b - a), 0, 1)
	return s * s * (3 - 2 * s)
end
local function easeOutExpo(s)
	s = clamp(s, 0, 1)
	if s >= 1 then
		return 1
	end
	return 1 - 2 ^ (-10 * s)
end
local function easeOutCubic(s)
	s = clamp(s, 0, 1)
	return 1 - (1 - s) ^ 3
end
local function easeOutBack(s)
	s = clamp(s, 0, 1)
	local c1 = 1.9
	local c3 = c1 + 1
	return 1 + c3 * (s - 1) ^ 3 + c1 * (s - 1) ^ 2
end

-- "Animation space": origin on the ground where the character stands,
-- -Z = towards the chest (same space as the preview and the generator).
local function spaceCFrame()
	local ground = anchor.CFrame * CFrame.new(0, -anchor.Size.Y / 2, 0)
	return ground * CFrame.new(0, 0, -CZ)
end

local function newPart(name, size, cf, color, material, parent)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material
	p.Parent = parent
	return p
end

local function domeMesh(part)
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Cylinder
	mesh.Parent = part
	return mesh
end

local function sampleLid(t)
	local n = #DATA.Lid
	local f = clamp(t * DATA.LidFps, 0, n - 1)
	local i = math.floor(f)
	local v0 = DATA.Lid[i + 1]
	local v1 = DATA.Lid[math.min(n, i + 2)]
	return v0 + (v1 - v0) * (f - i)
end

---------------------------------------------------------------------- build the chest
local S0 = spaceCFrame()
local visual = Instance.new("Model")
visual.Name = "ChestVisual"
visual.Parent = model

local base = newPart("Base", Vector3.new(W, BH, D), S0 * CFrame.new(0, BH / 2, CZ), WOOD, Enum.Material.Wood, visual)
base.CanCollide = true
base.CanQuery = true
newPart("BandBottom", Vector3.new(W + 0.12, 0.24, D + 0.12), S0 * CFrame.new(0, 0.12, CZ), GOLD, Enum.Material.Metal, visual)
newPart("BandTop", Vector3.new(W + 0.1, 0.16, D + 0.1), S0 * CFrame.new(0, BH - 0.08, CZ), GOLD, Enum.Material.Metal, visual)
for _, sx in ipairs({ -1, 1 }) do
	for _, sz in ipairs({ -1, 1 }) do
		newPart("Post", Vector3.new(0.24, BH, 0.24), S0 * CFrame.new(sx * (W / 2 - 0.04), BH / 2, CZ + sz * (D / 2 - 0.04)), GOLD, Enum.Material.Metal, visual)
	end
end
local innerGlow = newPart("InnerGlow", Vector3.new(W - 0.4, 0.1, D - 0.4), S0 * CFrame.new(0, BH - 0.1, CZ), GLOW, Enum.Material.Neon, visual)
innerGlow.Transparency = 1
local seam = newPart("SeamGlow", Vector3.new(W - 0.2, 0.06, 0.04), S0 * CFrame.new(0, BH + 0.03, FZ + 0.03), GLOW, Enum.Material.Neon, visual)
seam.Transparency = 1

-- lid (a Model pivoting on the hinge at the top back edge of the base)
local lid = Instance.new("Model")
lid.Name = "Lid"
lid.Parent = visual
newPart("LidBox", Vector3.new(W, 0.5, D), S0 * CFrame.new(0, BH + 0.25, CZ), WOOD, Enum.Material.Wood, lid)
domeMesh(newPart("LidDome", Vector3.new(W, 1.0, D), S0 * CFrame.new(0, BH + 0.5, CZ), WOOD, Enum.Material.Wood, lid))
for _, x in ipairs({ -1.55, 0, 1.55 }) do
	newPart("Band", Vector3.new(0.24, 0.52, D + 0.08), S0 * CFrame.new(x, BH + 0.25, CZ), GOLD, Enum.Material.Metal, lid)
	domeMesh(newPart("BandDome", Vector3.new(0.24, 1.08, D + 0.08), S0 * CFrame.new(x, BH + 0.5, CZ), GOLD, Enum.Material.Metal, lid))
end
newPart("Rim", Vector3.new(W + 0.1, 0.14, 0.14), S0 * CFrame.new(0, BH + 0.06, FZ + 0.02), GOLD, Enum.Material.Metal, lid)
newPart("LockPlate", Vector3.new(0.8, 0.66, 0.1), S0 * CFrame.new(0, BH + 0.26, FZ + 0.05), GOLD, Enum.Material.Metal, lid)
newPart("LockGem", Vector3.new(0.28, 0.34, 0.12), S0 * CFrame.new(0, BH + 0.28, FZ + 0.12), Color3.fromRGB(255, 79, 216), Enum.Material.Neon, lid)
lid.WorldPivot = S0 * CFrame.new(CH.Hinge)

local function setLid(S, angleDeg)
	lid:PivotTo(S * CFrame.new(CH.Hinge) * CFrame.Angles(-math.rad(angleDeg), 0, 0))
end

-- light and effects
local lightAttachment = Instance.new("Attachment")
lightAttachment.Position = Vector3.new(0, BH / 2 + 0.7, 0)
lightAttachment.Parent = base
local chestLight = Instance.new("PointLight")
chestLight.Color = Color3.fromRGB(255, 200, 90)
chestLight.Range = 18
chestLight.Brightness = 0
chestLight.Shadows = false
chestLight.Parent = lightAttachment

local pillar = newPart("Pillar", Vector3.new(0.1, 2, 2), S0, GLOW, Enum.Material.Neon, visual)
pillar.Shape = Enum.PartType.Cylinder
pillar.Transparency = 1
pillar.CastShadow = false
local pillarCore = newPart("PillarCore", Vector3.new(0.1, 1, 1), S0, Color3.fromRGB(255, 248, 225), Enum.Material.Neon, visual)
pillarCore.Shape = Enum.PartType.Cylinder
pillarCore.Transparency = 1
pillarCore.CastShadow = false
local shock = newPart("Shockwave", Vector3.new(0.08, 1, 1), S0, GLOW, Enum.Material.Neon, visual)
shock.Shape = Enum.PartType.Cylinder
shock.Transparency = 1
shock.CastShadow = false

local gem = newPart("RewardCrystal", Vector3.new(0.9, 0.9, 0.9), S0, Color3.fromRGB(150, 235, 255), Enum.Material.Neon, visual)
gem.Transparency = 1
gem.CastShadow = false
local gemLight = Instance.new("PointLight")
gemLight.Range = 10
gemLight.Brightness = 0
gemLight.Parent = gem

local emitterBox = newPart("EmitterBox", Vector3.new(W - 0.6, 0.2, D - 0.6), S0 * CFrame.new(0, BH + 0.05, CZ), GLOW, Enum.Material.SmoothPlastic, visual)
emitterBox.Transparency = 1

local function sparkleEmitter(parent)
	local e = Instance.new("ParticleEmitter")
	e.LightEmission = 1
	e.LightInfluence = 0
	e.Rate = 0
	e.Enabled = false
	e.EmissionDirection = Enum.NormalId.Top
	e.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 244, 200)),
		ColorSequenceKeypoint.new(0.5, Color3.fromRGB(255, 196, 70)),
		ColorSequenceKeypoint.new(1, Color3.fromRGB(255, 150, 60)),
	})
	e.Parent = parent
	return e
end

local burstEmitter = sparkleEmitter(emitterBox)
burstEmitter.Speed = NumberRange.new(14, 26)
burstEmitter.SpreadAngle = Vector2.new(28, 28)
burstEmitter.Lifetime = NumberRange.new(0.6, 1.3)
burstEmitter.Acceleration = Vector3.new(0, -18, 0)
burstEmitter.Drag = 2.5
burstEmitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.45), NumberSequenceKeypoint.new(0.6, 0.3), NumberSequenceKeypoint.new(1, 0) })
burstEmitter.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.75, 0.2), NumberSequenceKeypoint.new(1, 1) })

local riseEmitter = sparkleEmitter(emitterBox)
riseEmitter.Rate = 55
riseEmitter.Speed = NumberRange.new(3, 6.5)
riseEmitter.SpreadAngle = Vector2.new(12, 12)
riseEmitter.Lifetime = NumberRange.new(1.2, 2.2)
riseEmitter.Acceleration = Vector3.new(0, 1.5, 0)
riseEmitter.Drag = 0.4
riseEmitter.RotSpeed = NumberRange.new(-90, 90)
riseEmitter.Rotation = NumberRange.new(0, 360)
riseEmitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.15), NumberSequenceKeypoint.new(0.5, 0.32), NumberSequenceKeypoint.new(1, 0) })
riseEmitter.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.1, 0), NumberSequenceKeypoint.new(0.8, 0.3), NumberSequenceKeypoint.new(1, 1) })
riseEmitter.Color = ColorSequence.new({
	ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 230, 150)),
	ColorSequenceKeypoint.new(0.45, Color3.fromRGB(255, 196, 70)),
	ColorSequenceKeypoint.new(0.7, Color3.fromRGB(255, 140, 220)),
	ColorSequenceKeypoint.new(1, Color3.fromRGB(140, 220, 255)),
})

local feet = newPart("LandingSparkles", Vector3.new(1.5, 0.1, 1.5), S0 * CFrame.new(0, 0.05, 0), GLOW, Enum.Material.SmoothPlastic, visual)
feet.Transparency = 1
local landEmitter = sparkleEmitter(feet)
landEmitter.Speed = NumberRange.new(5, 10)
landEmitter.SpreadAngle = Vector2.new(80, 80)
landEmitter.Lifetime = NumberRange.new(0.4, 0.8)
landEmitter.Acceleration = Vector3.new(0, -20, 0)
landEmitter.Drag = 3
landEmitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 0) })

-- prompt
local prompt = Instance.new("ProximityPrompt")
prompt.ActionText = "Otwórz"
prompt.ObjectText = "Skrzynia Ultra Rare"
prompt.HoldDuration = 0
prompt.MaxActivationDistance = 10
prompt.RequiresLineOfSight = false
prompt.Parent = base

---------------------------------------------------------------------- animation id
local function resolveAnimationId()
	local value = model:FindFirstChild("AnimationId")
	local id = value and value.Value or ""
	if id ~= "" then
		if tonumber(id) then
			id = "rbxassetid://" .. id
		end
		return id
	end
	if RunService:IsStudio() then
		local ok, tempId = pcall(function()
			return KeyframeSequenceProvider:RegisterKeyframeSequence(sequence)
		end)
		if ok then
			return tempId
		end
		warn("[UltraRareChest] RegisterKeyframeSequence failed: " .. tostring(tempId))
	end
	return nil
end

local function setControls(enabled)
	pcall(function()
		local scripts = player:WaitForChild("PlayerScripts", 2)
		local module = scripts and scripts:WaitForChild("PlayerModule", 2)
		if module then
			local controls = require(module):GetControls()
			if enabled then
				controls:Enable()
			else
				controls:Disable()
			end
		end
	end)
end

---------------------------------------------------------------------- per-frame scene
local function glowLevel(t)
	if t < T_BURST then
		return smooth(0.42, 0.5, t) * (sampleLid(t) / 14) * (0.8 + 0.2 * math.noise(t * 22, 0.3))
	end
	local k = t - T_BURST
	return 0.9 + 3.2 * math.exp(-k * 7) + 0.6 * (1 - math.exp(-k * 2))
end

local ui = {}

local function updateScene(S, t)
	setLid(S, sampleLid(t))
	local g = glowLevel(t)
	local k = t - T_BURST
	chestLight.Brightness = (t < T_BURST) and g * 2.5 or g * 1.6
	seam.Transparency = (t < T_BURST + 0.05) and (1 - clamp(g * 1.2, 0, 0.9)) or 1
	innerGlow.Transparency = 1 - clamp(g * 0.6, 0, 0.92)

	if k > 0 then
		local len = 15 * easeOutExpo(k / 0.16)
		local width = lerp(3.8, 2.3, smooth(0, 0.4, k)) * (1 + 0.05 * math.sin(t * 9))
		pillar.Size = Vector3.new(math.max(len, 0.1), width, width)
		pillar.CFrame = S * CFrame.new(0, BH + len / 2, CZ) * CFrame.Angles(0, 0, math.rad(90))
		pillar.Transparency = lerp(0.25, 0.65, smooth(0.05, 0.9, k))
		pillarCore.Size = Vector3.new(math.max(len * 0.92, 0.1), width * 0.45, width * 0.45)
		pillarCore.CFrame = S * CFrame.new(0, BH + len * 0.46, CZ) * CFrame.Angles(0, 0, math.rad(90))
		pillarCore.Transparency = lerp(0.05, 0.45, smooth(0.05, 0.9, k))
		local rk = k / 0.45
		if rk < 1 then
			local d = lerp(1.2, 18, easeOutCubic(rk))
			shock.Size = Vector3.new(0.08, d, d)
			shock.CFrame = S * CFrame.new(0, BH + 0.06, CZ) * CFrame.Angles(0, 0, math.rad(90))
			shock.Transparency = lerp(0.2, 1, rk)
		else
			shock.Transparency = 1
		end
		riseEmitter.Enabled = k > 0.05
	else
		pillar.Transparency = 1
		pillarCore.Transparency = 1
		shock.Transparency = 1
		riseEmitter.Enabled = false
	end

	local gk = t - 0.95
	if gk > 0 then
		local y = lerp(-0.4, 3.1, easeOutBack(gk / 0.6))
		if t > 1.6 then
			y = y + 0.12 * math.sin((t - 1.6) * 5)
		end
		local sc = clamp(gk / 0.25, 0.01, 1)
		gem.Size = Vector3.new(0.9, 0.9, 0.9) * sc
		gem.CFrame = S * CFrame.new(0, BH + y, CZ) * CFrame.Angles(0, t * 2.6, 0) * CFrame.Angles(math.rad(45), 0, math.rad(35.26))
		gem.Transparency = 0.05
		gem.Color = Color3.fromHSV((t * 0.35) % 1, 0.5, 1)
		gemLight.Color = gem.Color
		gemLight.Brightness = 3 * sc
	else
		gem.Transparency = 1
		gemLight.Brightness = 0
	end

	if ui.flash then
		ui.flash.BackgroundTransparency = (k > 0) and (1 - 0.85 * math.exp(-k * 9)) or 1
		ui.bloom.Intensity = (k > 0) and (0.9 + 2 * math.exp(-k * 6)) or 0.9
		ui.color.Brightness = (k > 0) and (0.3 * math.exp(-k * 7)) or 0
		local rk2 = t - 1.1
		ui.banner.Visible = rk2 > 0
		if rk2 > 0 then
			ui.scale.Scale = 0.6 + 0.4 * easeOutBack(rk2 / 0.35)
			ui.gradient.Offset = Vector2.new(((rk2 * 0.7) % 1.4) - 0.7, 0)
		end
	end
end

---------------------------------------------------------------------- camera
local function cineCamera(t, aspect)
	local tgt = Vector3.new(0, 2.35, -1.55)
	tgt = tgt:Lerp(Vector3.new(0, 3.4, -1.9), smooth(1.0, 1.55, t))
	tgt = tgt:Lerp(Vector3.new(0, 2.75, -0.55), smooth(1.55, 2.25, t))
	local az = lerp(80, 84, smooth(0, 0.8, t))
	az = lerp(az, 76, smooth(1.5, 2.5, t))
	local el = lerp(12, 16, smooth(0.9, 1.5, t))
	el = lerp(el, 8, smooth(1.6, 2.4, t))
	local halfH = lerp(3.5, 3.3, smooth(0, 0.8, t))
	halfH = lerp(halfH, 4.6, smooth(0.8, 1.2, t))
	halfH = lerp(halfH, 3.55, smooth(1.6, 2.45, t))
	local halfW = lerp(3.6, 3.4, smooth(0, 0.8, t))
	halfW = lerp(halfW, 4.4, smooth(0.8, 1.2, t))
	halfW = lerp(halfW, 3.7, smooth(1.6, 2.45, t))
	local fov = 38
	local dist = math.max(halfH, halfW / aspect) / math.tan(math.rad(fov / 2))
	local a, e = math.rad(az), math.rad(el)
	local dir = Vector3.new(-math.sin(a) * math.cos(e), math.sin(e), -math.cos(a) * math.cos(e))
	return tgt, tgt + dir * dist, fov
end

local function updateCamera(S, t)
	local camera = workspace.CurrentCamera
	local vp = camera.ViewportSize
	local tgt, pos, fov = cineCamera(t, vp.X / math.max(vp.Y, 1))
	local cf = CFrame.lookAt(S:PointToWorldSpace(pos), S:PointToWorldSpace(tgt))
	local amp = 0
	if t > T_BURST then
		amp = amp + 0.16 * math.exp(-(t - T_BURST) * 9)
	end
	if t > T_LAND then
		amp = amp + 0.05 * math.exp(-(t - T_LAND) * 14)
	end
	if amp > 0.001 then
		local sx = math.noise(t * 38, 1.7) * amp
		local sy = math.noise(t * 41, 4.3) * amp
		cf = cf * CFrame.new(sx, sy, 0) * CFrame.Angles(sy * 0.05, sx * 0.05, 0)
	end
	camera.CFrame = cf
	camera.FieldOfView = fov
end

---------------------------------------------------------------------- UI + post effects
local function createUi()
	local gui = Instance.new("ScreenGui")
	gui.Name = "UltraRareReveal"
	gui.IgnoreGuiInset = true
	gui.ResetOnSpawn = false
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

	local flash = Instance.new("Frame")
	flash.Size = UDim2.fromScale(1, 1)
	flash.BackgroundColor3 = Color3.fromRGB(255, 246, 214)
	flash.BackgroundTransparency = 1
	flash.BorderSizePixel = 0
	flash.Parent = gui

	local banner = Instance.new("Frame")
	banner.AnchorPoint = Vector2.new(0.5, 0)
	banner.Position = UDim2.fromScale(0.5, 0.08)
	banner.Size = UDim2.fromScale(0.6, 0.16)
	banner.BackgroundTransparency = 1
	banner.Visible = false
	banner.Parent = gui
	local scale = Instance.new("UIScale")
	scale.Parent = banner

	local stars = Instance.new("TextLabel")
	stars.BackgroundTransparency = 1
	stars.Size = UDim2.fromScale(1, 0.28)
	stars.Text = "★★★★★"
	stars.TextScaled = true
	stars.Font = Enum.Font.GothamBlack
	stars.TextColor3 = Color3.fromRGB(255, 203, 82)
	stars.Parent = banner

	local title = Instance.new("TextLabel")
	title.BackgroundTransparency = 1
	title.Position = UDim2.fromScale(0, 0.28)
	title.Size = UDim2.fromScale(1, 0.72)
	title.Text = "ULTRA RARE"
	title.TextScaled = true
	title.Font = Enum.Font.GothamBlack
	title.TextColor3 = Color3.new(1, 1, 1)
	title.Parent = banner
	local gradient = Instance.new("UIGradient")
	gradient.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 243, 196)),
		ColorSequenceKeypoint.new(0.3, Color3.fromRGB(255, 203, 82)),
		ColorSequenceKeypoint.new(0.5, Color3.fromRGB(255, 255, 240)),
		ColorSequenceKeypoint.new(0.7, Color3.fromRGB(255, 154, 31)),
		ColorSequenceKeypoint.new(1, Color3.fromRGB(255, 243, 196)),
	})
	gradient.Rotation = 10
	gradient.Parent = title
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(122, 58, 0)
	stroke.Thickness = 3
	stroke.Parent = title

	gui.Parent = player:WaitForChild("PlayerGui")

	local bloom = Instance.new("BloomEffect")
	bloom.Name = "UltraRareBloom"
	bloom.Intensity = 0.9
	bloom.Size = 36
	bloom.Threshold = 0.85
	bloom.Parent = Lighting
	local color = Instance.new("ColorCorrectionEffect")
	color.Name = "UltraRareColor"
	color.TintColor = Color3.fromRGB(255, 246, 230)
	color.Parent = Lighting

	ui = { gui = gui, flash = flash, banner = banner, scale = scale, gradient = gradient, bloom = bloom, color = color }
end

local function destroyUi()
	for _, key in ipairs({ "gui", "bloom", "color" }) do
		if ui[key] then
			ui[key]:Destroy()
		end
	end
	ui = {}
end

---------------------------------------------------------------------- the reveal
local busy = false

local function openChest()
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not humanoid or not root then
		return
	end
	if humanoid.RigType ~= Enum.HumanoidRigType.R15 then
		warn("[UltraRareChest] This animation needs an R15 character.")
		return
	end
	local animator = humanoid:FindFirstChildOfClass("Animator")
	if not animator then
		animator = Instance.new("Animator")
		animator.Parent = humanoid
	end
	local animId = resolveAnimationId()
	if not animId then
		warn("[UltraRareChest] Publish the animation and put its id into the AnimationId value.")
		return
	end

	busy = true
	prompt.Enabled = false
	local S = spaceCFrame()
	local useCamera = true
	local camFlag = model:FindFirstChild("CinematicCamera")
	if camFlag and camFlag:IsA("BoolValue") then
		useCamera = camFlag.Value
	end

	-- stand in front of the chest, facing it
	local oldAutoRotate = humanoid.AutoRotate
	humanoid.AutoRotate = false
	setControls(false)
	root.AssemblyLinearVelocity = Vector3.zero
	root.AssemblyAngularVelocity = Vector3.zero
	root.CFrame = S * CFrame.new(0, humanoid.HipHeight + root.Size.Y / 2, 0)
	root.Anchored = true

	local animation = Instance.new("Animation")
	animation.AnimationId = animId
	local track = animator:LoadAnimation(animation)
	track.Priority = Enum.AnimationPriority.Action
	track.Looped = false
	local waited = 0
	while track.Length <= 0 and waited < 3 do
		waited = waited + task.wait()
	end

	createUi()
	local camera = workspace.CurrentCamera
	local oldCameraType = camera.CameraType
	local oldFov = camera.FieldOfView
	if useCamera then
		camera.CameraType = Enum.CameraType.Scriptable
	end

	-- one-shot effects on the animation's markers
	local connections = {}
	table.insert(connections, track:GetMarkerReachedSignal("LidBurst"):Connect(function()
		burstEmitter:Emit(90)
	end))
	table.insert(connections, track:GetMarkerReachedSignal("Land"):Connect(function()
		landEmitter:Emit(40)
	end))

	local t = 0
	local frozen = false
	table.insert(connections, track.Stopped:Connect(function()
		frozen = true
	end))
	RunService:BindToRenderStep("UltraRareChest", Enum.RenderPriority.Camera.Value + 1, function()
		if track.IsPlaying and not frozen then
			t = track.TimePosition
			if track.Length > 0 and t >= track.Length - 0.035 then
				track:AdjustSpeed(0) -- hold the final pose
				frozen = true
			end
		end
		if frozen then
			t = DATA.Duration
		end
		updateScene(S, t)
		if useCamera then
			updateCamera(S, t)
		end
	end)
	track:Play(0.12, 1, 1)

	local started = os.clock()
	while not frozen and os.clock() - started < DATA.Duration + 4 do
		task.wait()
	end
	task.wait(1.6)

	-- back to normal
	RunService:UnbindFromRenderStep("UltraRareChest")
	for _, c in ipairs(connections) do
		c:Disconnect()
	end
	track:Stop(0.4)
	destroyUi()
	if useCamera then
		camera.CameraType = oldCameraType
		camera.FieldOfView = oldFov
		camera.CameraSubject = humanoid
	end
	root.Anchored = false
	humanoid.AutoRotate = oldAutoRotate
	setControls(true)

	-- fade the light, close the lid, re-arm the prompt
	riseEmitter.Enabled = false
	for _, p in ipairs({ pillar, pillarCore, gem }) do
		TweenService:Create(p, TweenInfo.new(0.6), { Transparency = 1 }):Play()
	end
	TweenService:Create(chestLight, TweenInfo.new(0.8), { Brightness = 0 }):Play()
	TweenService:Create(gemLight, TweenInfo.new(0.6), { Brightness = 0 }):Play()
	TweenService:Create(innerGlow, TweenInfo.new(0.8), { Transparency = 1 }):Play()
	task.wait(1.5)
	local angle = Instance.new("NumberValue")
	angle.Value = sampleLid(DATA.Duration)
	local conn = angle.Changed:Connect(function(v)
		setLid(S, v)
	end)
	local close = TweenService:Create(angle, TweenInfo.new(0.7, Enum.EasingStyle.Bounce, Enum.EasingDirection.Out), { Value = 0 })
	close:Play()
	close.Completed:Wait()
	conn:Disconnect()
	angle:Destroy()
	busy = false
	prompt.Enabled = true
end

prompt.Triggered:Connect(function(who)
	if who == player and not busy then
		task.spawn(openChest)
	end
end)
