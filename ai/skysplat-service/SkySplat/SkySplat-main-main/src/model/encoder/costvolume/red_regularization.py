import numpy as np
import torch, math
from pyquaternion import Quaternion
from torch.cuda.amp import autocast
from einops import reduce
import torch.nn.functional as F
import pymap3d
import torch.nn as nn

class RED_Regularization(nn.Module):
    def __init__(self, in_channels, base_channels = 8):
        super(RED_Regularization, self).__init__()
        self.base_channels = base_channels
        self.conv_gru1 = ConvGRUCell2(in_channels, base_channels, 3)
        self.conv_gru2 = ConvGRUCell2(base_channels * 2 , base_channels * 2, 3)
        self.conv_gru3 = ConvGRUCell2(base_channels * 4, base_channels * 4, 3)
        self.conv_gru4 = ConvGRUCell2(base_channels * 8 , base_channels * 8, 3)
        self.conv1 = ConvReLU(in_channels, base_channels * 2, 3, 2, 1)
        self.conv2 = ConvReLU(base_channels * 2, base_channels * 4, 3, 2, 1)
        self.conv3 = ConvReLU(base_channels * 4, base_channels * 8, 3, 2, 1)
        self.upconv3 = ConvTransReLU(base_channels * 8, base_channels * 4, 3, 2, 1, 1)
        self.upconv2 = ConvTransReLU(base_channels * 4, base_channels * 2, 3, 2, 1, 1)
        self.upconv1 = ConvTransReLU(base_channels * 2, base_channels, 3, 2, 1, 1)
        # self.upconv2d = nn.ConvTranspose2d(base_channels, 1, kernel_size=3, stride=2, padding=1, output_padding=1)
        self.upconv2d = nn.ConvTranspose2d(base_channels, 1, kernel_size=3, stride=1, padding=1, output_padding=0)
        #self.GPM = GlobalPoolingModule(64,64)
        #self.CAM = ChannelAttentionModule(32, 32)

    def forward(self, volume_variance):
        device = volume_variance.device
        depth_costs = []
        b_num, f_num, d_num, img_h, img_w = volume_variance.shape
        state1 = torch.zeros((b_num, 8, img_h, img_w)).to(device)
        state2 = torch.zeros((b_num, 16, int(img_h / 2), int(img_w / 2))).to(device)
        state3 = torch.zeros((b_num, 32, int(img_h / 4), int(img_w / 4))).to(device)
        state4 = torch.zeros((b_num, 64, int(img_h / 8), int(img_w / 8))).to(device)

        cost_list = volume_variance.chunk(d_num, dim=2)
        cost_list = [cost.squeeze(2) for cost in cost_list]

        for cost in cost_list:
            # Recurrent Regularization
            conv_cost1 = self.conv1(-cost)
            conv_cost2 = self.conv2(conv_cost1)
            conv_cost3 = self.conv3(conv_cost2)
            reg_cost4, state4 = self.conv_gru4(conv_cost3, state4)

            # up_cost3 = self.upconv3(self.GPM(reg_cost4))
            up_cost3 = self.upconv3(reg_cost4)
            reg_cost3, state3 = self.conv_gru3(conv_cost2, state3)
            up_cost33 = torch.add(up_cost3, reg_cost3)
            # up_cost33 = self.CAM(up_cost3, reg_cost3)
            up_cost2 = self.upconv2(up_cost33)
            reg_cost2, state2 = self.conv_gru2(conv_cost1, state2)
            up_cost22 = torch.add(up_cost2, reg_cost2)
            up_cost1 = self.upconv1(up_cost22)
            reg_cost1, state1 = self.conv_gru1(-cost, state1)
            up_cost11 = torch.add(up_cost1, reg_cost1)
            reg_cost = self.upconv2d(up_cost11)
            depth_costs.append(reg_cost)

        prob_volume = torch.stack(depth_costs, dim=1)
        prob_volume = prob_volume.squeeze(2)

        return prob_volume

class ConvGRUCell2(nn.Module):
    def __init__(self, input_channel, output_channel, kernel_size):
        super(ConvGRUCell2, self).__init__()

        # filters used for gates
        gru_input_channel = input_channel + output_channel
        self.output_channel = output_channel

        self.gate_conv = nn.Conv2d(gru_input_channel, output_channel * 2, kernel_size, padding=1)
        self.reset_gate_norm = nn.GroupNorm(1, output_channel, 1e-5, True)
        self.update_gate_norm = nn.GroupNorm(1, output_channel, 1e-5, True)

        # filters used for outputs
        self.output_conv = nn.Conv2d(gru_input_channel, output_channel, kernel_size, padding=1)
        self.output_norm = nn.GroupNorm(1, output_channel, 1e-5, True)

        self.activation = nn.Tanh()

    def gates(self, x, h):
        # x = N x C x H x W
        # h = N x C x H x W

        # c = N x C*2 x H x W
        c = torch.cat((x, h), dim=1)
        f = self.gate_conv(c)

        # r = reset gate, u = update gate
        # both are N x O x H x W
        C = f.shape[1]
        r, u = torch.split(f, C // 2, 1)

        rn = self.reset_gate_norm(r)
        un = self.update_gate_norm(u)
        rns = torch.sigmoid(rn)
        uns = torch.sigmoid(un)
        return rns, uns

    def output(self, x, h, r, u):
        f = torch.cat((x, r * h), dim=1)
        o = self.output_conv(f)
        on = self.output_norm(o)
        return on

    def forward(self, x, h = None):
        N, C, H, W = x.shape
        HC = self.output_channel
        if(h is None):
            h = torch.zeros((N, HC, H, W), dtype=torch.float, device=x.device)
        r, u = self.gates(x, h)
        o = self.output(x, h, r, u)
        y = self.activation(o)
        output = u * h + (1 - u) * y
        return output, output


class ConvReLU(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size=3, stride=1, pad=1):
        super(ConvReLU, self).__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size, stride=stride, padding=pad, bias=False)

    def forward(self, x):
        return F.relu(self.conv(x), inplace=True)

class ConvTransReLU(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size=3, stride=1, pad=1, output_pad=1):
        super(ConvTransReLU, self).__init__()
        self.conv = nn.ConvTranspose2d(in_channels, out_channels, kernel_size=kernel_size, stride=stride, padding=pad, output_padding=output_pad, bias=False)


    def forward(self, x):
        return F.relu(self.conv(x), inplace=True)


def normalize(x):
    min_val = x.min()
    max_val = x.max()
    return (x - min_val) / (max_val - min_val + 1e-8)


class MLPModel(nn.Module):
    def __init__(self):
        super(MLPModel, self).__init__()
        self.linear = nn.Sequential(
            nn.Linear(384, 64),
            nn.ReLU()
        )
        self.conv = nn.Sequential(
            nn.Conv2d(64, 16, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(16, 1, 1),
            nn.Sigmoid(),
        )
    def forward(self, features):
        B, C, HW, D = features.shape
        H = W = int(HW ** 0.5)
        x = features.view(B * C * HW, D)  # [B*C*HW, D]
        x = self.linear(x)  # [B*C*HW, 64]
        x = x.view(B, C, H, W, 64)  # [B, C, H, W, 64]
        x = x.permute(0, 1, 4, 2, 3)  # [B, C, 64, H, W]
        x = x.reshape(B * C, 64, H, W)  # [B*C, 64, H, W]
        x = self.conv(x)  # [B*C, 1, H, W]
        x = x.view(B, C, H, W)  # [B, C, H, W]
        return x
