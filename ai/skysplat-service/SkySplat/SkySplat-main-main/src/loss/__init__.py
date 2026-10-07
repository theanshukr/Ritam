from .loss import Loss
from .loss_depth import LossDepth, LossDepthCfgWrapper
from .loss_lpips import LossLpips, LossLpipsCfgWrapper
from .loss_mse import LossMse, LossMseCfgWrapper
from .loss_feature import LossFeature, LossFeatureCfgWrapper
from .loss_relheight import LossRelHeight, LossRelHeightCfgWrapper

LOSSES = {
    LossDepthCfgWrapper: LossDepth,
    LossLpipsCfgWrapper: LossLpips,
    LossMseCfgWrapper: LossMse,

    LossFeatureCfgWrapper: LossFeature,
    LossRelHeightCfgWrapper: LossRelHeight,
}

LossCfgWrapper = (
    LossDepthCfgWrapper
    | LossLpipsCfgWrapper
    | LossMseCfgWrapper
    | LossFeatureCfgWrapper
    | LossRelHeightCfgWrapper
)



def get_losses(cfgs: list[LossCfgWrapper]) -> list[Loss]:
    return [LOSSES[type(cfg)](cfg) for cfg in cfgs]
